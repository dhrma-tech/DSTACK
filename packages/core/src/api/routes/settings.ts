/**
 * Settings API routes
 * Handles project settings retrieval
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Contracts } from "@dstack/shared";
import { SettingsService } from "../../services/settings-service.js";
import { sendApiSuccess, sendApiError } from "../errors.js";

export class SettingsRoutes {
  private readonly settingsService: SettingsService;

  constructor(private projectRoot: string, private options: { allowSecrets?: boolean; allowAbsolutePaths?: boolean } = {}) {
    const serviceOptions: { projectRoot: string; allowSecrets?: boolean; allowAbsolutePaths?: boolean } = {
      projectRoot,
      ...(options.allowSecrets !== undefined && { allowSecrets: options.allowSecrets }),
      ...(options.allowAbsolutePaths !== undefined && { allowAbsolutePaths: options.allowAbsolutePaths })
    };
    this.settingsService = new SettingsService(serviceOptions);
  }

  async handleGetSettings(
    req: IncomingMessage, 
    res: ServerResponse, 
    requestId: string
  ): Promise<void> {
    try {
      const settings = await this.settingsService.getSettings();
      
      // Remove secrets from settings
      const safeSettings: Contracts.Settings = {
        ...settings,
        allowSecrets: false // Never expose secret setting in API
      };

      sendApiSuccess(res, safeSettings, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }
}
