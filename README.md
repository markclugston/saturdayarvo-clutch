# saturdayarvo-clutch
Budget and Finance Guidance

## Debugging in VS Code

Install the .NET SDK, Node.js, and the C# debugger extension. Install the
frontend dependencies with `npm install` in `src/clutch-web`.
Install the EF Core CLI (`dotnet tool install --global dotnet-ef`) if it is
not already available, and configure the development database connection in
the API's user secrets.

Open the repository folder in VS Code and select **API + Frontend** in the
Run and Debug configuration dropdown. Press F5 to build the API and apply any
pending EF Core migrations to the configured Development database before the
API starts. The frontend also starts, and the default browser opens
http://localhost:5173/ when Vite is ready. Ensure the configured database is
the intended development target and back it up before migrations when needed.
If the build or migration fails, resolve the error rather than proceeding with
debugging. VS Code remembers the selected configuration, so this works regardless
of the active file. If another configuration was previously selected, select
**API + Frontend** once. While debugging, F5 continues a paused session.
If the C# Dev Tools extension launches only its startup project on F5, remove
its **Debug Startup Project** F5 shortcut in VS Code's Keyboard Shortcuts so
the standard **Start Debugging** shortcut can launch the selected configuration.

The frontend requires port 5173 to be free; it reports an error instead of
silently switching ports. Stop the debug session to stop both projects.
