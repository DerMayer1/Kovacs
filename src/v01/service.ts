import { randomUUID } from "node:crypto";
import type { V01Config } from "./config.js";
import { loadV01Config } from "./config.js";
import { createContractValidator, type ContractValidator } from "./contracts.js";
import { prepareContext } from "./context.js";
import { CodexExecGateway } from "./codex-exec.js";
import { buildPrompt } from "./prompt.js";
import { SessionStore } from "./session-store.js";
import { validateAssistance } from "./assistance.js";
import type {
  AssistanceLevel,
  ManualRequest,
  Mode,
  Profile,
  ProfileResponse,
  ReasoningGateway,
  Sensitivity,
  ServiceResult,
  SessionRecord,
} from "./types.js";

export interface InterventionInput {
  requestId?: string;
  requestedHelp: string;
  currentHypothesis?: string | null;
  attempts?: string[];
  allowedAssistance: AssistanceLevel;
  sensitivity?: Sensitivity;
  terminal?: string;
  notes?: string;
  selectedFiles?: string[];
  imagePaths?: string[];
}

export interface KovacsServiceDependencies {
  config: V01Config;
  contracts: ContractValidator;
  sessions: SessionStore;
  gateway: ReasoningGateway;
}

export class KovacsService {
  constructor(private readonly dependencies: KovacsServiceDependencies) {}

  static async create(config = loadV01Config(), gateway?: ReasoningGateway): Promise<KovacsService> {
    const contracts = await createContractValidator(config.contractsDirectory);
    return new KovacsService({
      config,
      contracts,
      sessions: new SessionStore(config.dataDirectory, contracts),
      gateway: gateway ?? new CodexExecGateway(config),
    });
  }

  start(project: string, task: string, mode: Mode): Promise<SessionRecord> {
    if (!task.trim()) throw new Error("Session task cannot be empty.");
    return this.dependencies.sessions.start(project, task.trim(), mode);
  }

  status(sessionId: string): Promise<SessionRecord> {
    return this.dependencies.sessions.load(sessionId);
  }

  async intervene(sessionId: string, profile: Profile, input: InterventionInput): Promise<ServiceResult> {
    const session = await this.dependencies.sessions.load(sessionId);
    const requestId = input.requestId ?? `req_${randomUUID().replaceAll("-", "")}`;
    const prior = session.events.find((event) => event.request_id === requestId && event.type === "intervention_displayed");
    if (prior) {
      const response = prior.payload.response as unknown;
      this.dependencies.contracts.validateResponse(response);
      return {
        response,
        cached: true,
        redaction_count: Number(prior.payload.redaction_count ?? 0),
        context_truncated: Boolean(prior.payload.context_truncated),
        gateway_duration_ms: Number(prior.payload.gateway_duration_ms ?? 0),
        prompt_characters: Number(prior.payload.prompt_characters ?? 0),
      };
    }
    if (session.events.some((event) => event.request_id === requestId)) {
      throw new Error(`Request identifier has already been consumed: ${requestId}`);
    }
    if (session.status !== "active") throw new Error(`Session is already ${session.status}.`);

    const request: ManualRequest = {
      schema_version: "0.1.0",
      request_id: requestId,
      session_id: session.session_id,
      profile,
      mode: session.mode,
      project: session.project,
      task: session.task,
      current_hypothesis: input.currentHypothesis ?? null,
      attempts: input.attempts ?? [],
      requested_help: input.requestedHelp.trim(),
      allowed_assistance: input.allowedAssistance,
      sensitivity: input.sensitivity ?? "internal",
      context: {
        terminal: input.terminal ?? "",
        notes: input.notes ?? "",
        selected_files: input.selectedFiles ?? [],
      },
    };
    this.dependencies.contracts.validateRequest(request);

    let context;
    try {
      context = await prepareContext(request, {
        characterBudget: this.dependencies.config.contextCharacterBudget,
        selectedFileCharacterLimit: this.dependencies.config.selectedFileCharacterLimit,
      });
    } catch (error) {
      await this.dependencies.sessions.append(sessionId, {
        type: "request_blocked",
        request_id: requestId,
        payload: { profile, reason: (error as Error).message },
      });
      throw error;
    }

    const accepted = await this.dependencies.sessions.append(sessionId, {
      type: "request_accepted",
      request_id: requestId,
      payload: {
        profile,
        allowed_assistance: request.allowed_assistance,
        sensitivity: request.sensitivity,
        redaction_count: context.redaction_count,
        context_truncated: context.truncated,
      },
    });
    const prompt = buildPrompt(request, context, accepted.event.event_id);

    let execution;
    try {
      execution = await this.dependencies.gateway.execute({
        request,
        project: session.project,
        prompt,
        ...(input.imagePaths?.length ? { imagePaths: input.imagePaths } : {}),
      });
    } catch (error) {
      await this.dependencies.sessions.append(sessionId, {
        type: "gateway_failed",
        request_id: requestId,
        payload: { profile, reason: (error as Error).message },
      });
      throw error;
    }

    let response: ProfileResponse;
    try {
      this.dependencies.contracts.validateResponse(execution.response);
      response = execution.response;
      validateAssistance(request, response);
    } catch (error) {
      await this.dependencies.sessions.append(sessionId, {
        type: "response_rejected",
        request_id: requestId,
        payload: { profile, reason: (error as Error).message },
      });
      throw error;
    }

    await this.dependencies.sessions.append(sessionId, {
      type: "intervention_displayed",
      request_id: requestId,
      payload: {
        response,
        redaction_count: context.redaction_count,
        context_truncated: context.truncated,
        gateway_duration_ms: execution.duration_ms,
        prompt_characters: prompt.length,
      },
    });
    if (profile === "debrief") await this.dependencies.sessions.complete(sessionId, requestId);

    return {
      response,
      cached: false,
      redaction_count: context.redaction_count,
      context_truncated: context.truncated,
      gateway_duration_ms: execution.duration_ms,
      prompt_characters: prompt.length,
    };
  }
}
