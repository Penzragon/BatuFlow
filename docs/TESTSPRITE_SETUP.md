# TestSprite MCP — Setup & Testing BatuFlow

This guide explains how to install TestSprite MCP in Cursor and run tests on the BatuFlow app.

## Prerequisites

- **Node.js >= 22** — Run `node --version` to check (in WSL if your project runs there).
- **TestSprite account** — [Sign up for free](https://www.testsprite.com/auth/cognito/sign-up).
- **API key** — From [TestSprite Dashboard](https://www.testsprite.com/dashboard) → Settings → API Keys → New API Key.

---

## Cursor on Windows + project in WSL

If **Cursor is installed on Windows** and your **project lives in WSL** (e.g. `/home/rifky/BatuFlow`), Cursor talks to MCP servers from the Windows side. A **global** TestSprite config (in Cursor Settings) runs the MCP with **Windows** Node and paths, so the agent in a WSL workspace often **does not see** TestSprite (it’s not in the “available servers” list for that chat).

**Fix:** use a **project-level** MCP config so TestSprite runs **inside WSL**. This repo already has:

- **`.cursor/mcp.json`** — runs TestSprite via `wsl bash -ic`, so the server uses WSL Node and your project paths.

**What you need to do:**

1. **Set your API key in WSL** (so the MCP can use it when Cursor starts it):
   ```bash
   # In WSL, add to ~/.bashrc (or ~/.profile):
   export API_KEY="your-testsprite-api-key"
   ```
   Then run `source ~/.bashrc` or open a new WSL terminal.

2. **Reload Cursor’s MCP list**  
   Restart Cursor or use the MCP refresh so it picks up `.cursor/mcp.json`. The project-level config overrides/extends the global one for this workspace.

3. **Check TestSprite in this workspace**  
   In a chat with the BatuFlow folder open, ask: *“What MCP servers do you have?”* or *“Help me test this project with TestSprite.”*  
   You should see **TestSprite** among the available servers when the project is open.

You can keep TestSprite in **Cursor Settings** for non-WSL projects; for this WSL project, `.cursor/mcp.json` is what makes it available to the agent.

---

## Installation in Cursor (global / non-WSL)

If you are **not** using WSL, or want TestSprite available in all projects:

### Option 1: One-click (recommended)

1. Get your [API key](https://www.testsprite.com/dashboard) (Settings → API Keys).
2. Use the [one-click install link](cursor://anysphere.cursor-deeplink/mcp/install?name=TestSprite&config=eyJjb21tYW5kIjoibnB4IEB0ZXN0c3ByaXRlL3Rlc3RzcHJpdGUtbWNwQGxhdGVzdCIsImVudiI6eyJBUElfS0VZIjoiIn19).
3. When Cursor prompts, enter your API key.

### Option 2: Manual

1. Open **Cursor Settings** (⌘⇧J or Ctrl+Shift+J).
2. Go to **Tools & Integration** → **Add custom MCP**.
3. Add this config (replace `your-api-key` with your real key):

```json
{
  "mcpServers": {
    "TestSprite": {
      "command": "npx",
      "args": ["@testsprite/testsprite-mcp@latest"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

4. Confirm the TestSprite MCP server shows a green dot and tools are loaded.

## Cursor sandbox setting (important)

For TestSprite to run tests correctly:

1. Go to **Chat** → **Auto-Run** → **Auto-Run Mode**.
2. Set to **"Ask Everytime"** or **"Run Everything"** (not "Run in Sandbox").

## Running tests on BatuFlow

1. **Start the app** (so TestSprite can hit it):
   ```bash
   npm run dev
   ```
   Default URL: `http://localhost:3000`.

2. In Cursor chat, ask:
   ```
   Help me test this project with TestSprite.
   ```
   or:
   ```
   Test the BatuFlow project app using TestSprite MCP.
   ```

3. The assistant will use TestSprite to:
   - Analyze PRD/code and build a normalized PRD
   - Generate a test plan and test cases
   - Run tests (e.g. against your running app)
   - Produce reports (JSON, MD, HTML, PDF) in `testsprite_tests/`

## Project context

- **Stack:** Next.js 16, React 19, Prisma, PostgreSQL.
- **App type:** ERP for distribution/wholesale (Sales, Inventory, Accounting, HR, Expenses, Delivery, Warehouse).
- **Relevant docs:** `PRD.md` in the project root.

## References

- [TestSprite MCP Installation](https://docs.testsprite.com/mcp/getting-started/installation)
- [MCP Demo & Examples](https://docs.testsprite.com/learn/mcp-demo)
