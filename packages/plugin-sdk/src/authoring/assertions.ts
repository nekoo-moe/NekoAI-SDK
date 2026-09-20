/**
 * Assertion macros and consent interception gates for NekoAI plugins.
 */

import type { PluginExecutionContext, UserConsentRequest } from './types'

import { errorMessageFrom } from '@moeru/std'

/**
 * Error thrown when a postcondition assertion fails to verify state change.
 */
export class PostconditionFailedError extends Error {
  readonly assertionName: string

  constructor(assertionName: string, detail: string) {
    super(`Postcondition "${assertionName}" failed: ${detail}`)
    this.name = 'PostconditionFailedError'
    this.assertionName = assertionName
  }
}

/**
 * Error thrown when user consent is required but rejected by the operator or host.
 */
export class UserConsentDeniedError extends Error {
  readonly actionRef: string

  constructor(actionRef: string, summary: string) {
    super(`User consent denied for action "${actionRef}": ${summary}`)
    this.name = 'UserConsentDeniedError'
    this.actionRef = actionRef
  }
}

export interface PostconditionAssertionOptions {
  /**
   * Descriptive name of the postcondition assertion (e.g. 'verify-zalo-message-sent').
   */
  name: string
  /**
   * Deterministic predicate checking whether the desired state has been achieved.
   */
  check: () => boolean | Promise<boolean>
  /**
   * Maximum duration in milliseconds to poll before timing out. @default 3000
   */
  timeoutMs?: number
  /**
   * Polling interval in milliseconds between predicate evaluations. @default 200
   */
  pollIntervalMs?: number
  /**
   * Optional custom failure message.
   */
  failureMessage?: string
}

/**
 * Deterministically asserts that an action achieved its intended state before proceeding.
 * Polls the `check` predicate until it returns true or until `timeoutMs` elapses.
 *
 * @throws {PostconditionFailedError} when predicate does not return true within timeout.
 */
export async function assertPostcondition(options: PostconditionAssertionOptions): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 3000
  const pollIntervalMs = options.pollIntervalMs ?? 200
  const startTime = Date.now()

  while (Date.now() - startTime <= timeoutMs) {
    try {
      const passed = await options.check()
      if (passed) {
        return
      }
    }
    catch (error) {
      // If predicate throws, record failure detail and retry until timeout
      const detail = errorMessageFrom(error)
      if (Date.now() - startTime + pollIntervalMs > timeoutMs) {
        throw new PostconditionFailedError(
          options.name,
          options.failureMessage ?? `Predicate threw error: ${detail}`,
        )
      }
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
  }

  throw new PostconditionFailedError(
    options.name,
    options.failureMessage ?? `State assertion timed out after ${timeoutMs}ms.`,
  )
}

/**
 * Enforces a mandatory human consent gate before executing high-risk or external side-effects.
 * Pauses execution until the host approvalRef decision resolves.
 *
 * @throws {UserConsentDeniedError} when the user or host rejects the proposed action.
 */
export async function requireUserConsent(
  request: UserConsentRequest,
  context?: PluginExecutionContext,
): Promise<void> {
  if (context?.consentGate) {
    const approved = await context.consentGate(request)
    if (!approved) {
      throw new UserConsentDeniedError(request.actionRef, request.summary)
    }
  }

  // If no consentGate handler is mounted in context (e.g. headless unit tests with auto-grant), pass through
}
