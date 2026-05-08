import { Router, type Express, type Request, type Response } from "express";
import { agentEventSchema } from "@dstack/shared";
import { globalWorkflowRunner } from "../stream/workflow-runner";

export const workflowsRouter = Router();

interface WorkflowStartBody {
  prompt?: unknown;
}

interface ApprovalBody {
  decision?: unknown;
}

export const attachWorkflowRoutes = (app: Express): void => {
  app.post("/api/workflows/runs", (req: Request<unknown, unknown, WorkflowStartBody>, res: Response) => {
    const prompt = typeof req.body.prompt === "string" && req.body.prompt.trim()
      ? req.body.prompt.trim()
      : "Build the DStack web-native vertical slice.";
    const run = globalWorkflowRunner.start({ prompt });
    res.json({ runId: run.id, status: run.status, createdAt: run.createdAt });
  });

  app.get("/api/workflows/runs/:runId/stream", (req, res) => {
    const run = globalWorkflowRunner.get(req.params.runId);
    if (!run) {
      res.status(404).json({ error: "Workflow run not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for (const event of run.events) {
      res.write(`data: ${JSON.stringify(agentEventSchema.parse(event))}\n\n`);
    }

    const listener = (event: unknown): void => {
      const parsed = agentEventSchema.parse(event);
      res.write(`data: ${JSON.stringify(parsed)}\n\n`);
      if (parsed.type === "run_complete" || parsed.type === "run_error") res.end();
    };

    run.emitter.on("event", listener);
    req.on("close", () => {
      run.emitter.off("event", listener);
    });
  });

  app.post("/api/workflows/runs/:runId/approvals", (req: Request<{ runId: string }, unknown, ApprovalBody>, res: Response) => {
    const decision = req.body.decision;
    if (decision !== "approve" && decision !== "deny") {
      res.status(400).json({ error: "Invalid decision. Must be approve or deny." });
      return;
    }
    const accepted = globalWorkflowRunner.approve(req.params.runId, decision);
    if (!accepted) {
      res.status(404).json({ error: "No pending approval for workflow run." });
      return;
    }
    res.json({ ok: true });
  });

  app.get("/api/sandbox/preview", (_req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Inter, system-ui, sans-serif; background: #fafafa; color: #171717; }
      main { width: min(760px, calc(100vw - 32px)); border: 1px solid #e5e5e5; border-radius: 8px; background: white; padding: 32px; }
      p:first-child { color: #9d7fe6; font-weight: 700; text-transform: uppercase; font-size: 12px; }
      h1 { font-size: 40px; line-height: 1.05; letter-spacing: 0; }
    </style>
  </head>
  <body>
    <main>
      <p>DStack Preview</p>
      <h1>Verified sandbox preview is ready.</h1>
      <p>The WebContainer adapter can replace this static preview when running fully in the browser.</p>
    </main>
  </body>
</html>`);
  });
};
