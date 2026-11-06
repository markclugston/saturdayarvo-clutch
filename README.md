# saturdayarvo-clutch
Budget and Finance Guidance

## Debugging in VS Code

Install the .NET SDK, Node.js, and the C# debugger extension. Install the
frontend dependencies with `npm install` in `src/clutch-web`.

Open the repository folder in VS Code and select **API + Frontend** in the
Run and Debug configuration dropdown. Press F5 to build and start the API and
start the frontend; the default browser opens http://localhost:5173/ when Vite
is ready. VS Code remembers the selected configuration, so this works regardless
of the active file. If another configuration was previously selected, select
**API + Frontend** once. While debugging, F5 continues a paused session.
If the C# Dev Tools extension launches only its startup project on F5, remove
its **Debug Startup Project** F5 shortcut in VS Code's Keyboard Shortcuts so
the standard **Start Debugging** shortcut can launch the selected configuration.

The frontend requires port 5173 to be free; it reports an error instead of
silently switching ports. Stop the debug session to stop both projects.
