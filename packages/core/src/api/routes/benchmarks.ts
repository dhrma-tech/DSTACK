/**
 * Benchmarks API routes
 * Handles benchmark listing and retrieval
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { BenchmarkService } from "../../services/benchmark-service.js";
import { sendApiSuccess, sendApiError, ValidationError } from "../errors.js";

export class BenchmarksRoutes {
  private readonly benchmarkService: BenchmarkService;

  constructor(private projectRoot: string, private options: { allowSecrets?: boolean; allowAbsolutePaths?: boolean } = {}) {
    const serviceOptions: { projectRoot: string; allowSecrets?: boolean; allowAbsolutePaths?: boolean } = {
      projectRoot,
      ...(options.allowSecrets !== undefined && { allowSecrets: options.allowSecrets }),
      ...(options.allowAbsolutePaths !== undefined && { allowAbsolutePaths: options.allowAbsolutePaths })
    };
    this.benchmarkService = new BenchmarkService(serviceOptions);
  }

  async handleListBenchmarks(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const suiteName = url.searchParams.get('suiteName');
      const liveMode = url.searchParams.get('liveMode') === 'true';
      const limit = url.searchParams.get('limit');

      const benchmarks = await this.benchmarkService.listBenchmarkRuns(limit ? parseInt(limit, 10) : 10);
      
      // Filter by suiteName if provided
      const filteredBenchmarks = suiteName 
        ? benchmarks.filter(benchmark => benchmark.suiteName === suiteName)
        : benchmarks;

      // Filter by liveMode if provided
      const finalBenchmarks = liveMode 
        ? filteredBenchmarks.filter(benchmark => benchmark.liveMode)
        : filteredBenchmarks;

      sendApiSuccess(res, finalBenchmarks, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }

  async handleGetBenchmark(
    req: IncomingMessage, 
    res: ServerResponse, 
    url: URL, 
    requestId: string
  ): Promise<void> {
    try {
      const pathParts = url.pathname.split('/');
      const benchmarkId = pathParts[pathParts.length - 1]; // /benchmarks/:id

      if (!benchmarkId) {
        throw new ValidationError('Benchmark ID is required');
      }

      const benchmark = await this.benchmarkService.getBenchmarkRun(benchmarkId);
      
      // Return null with ok:true if no benchmark found
      sendApiSuccess(res, benchmark, requestId);
    } catch (error) {
      sendApiError(res, error as Error, requestId);
    }
  }
}
