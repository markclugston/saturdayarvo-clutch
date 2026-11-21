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

## Coordinated transaction imports

The import screen checks account availability before a new upload and refreshes while
waiting. Only an unconfirmed competing preview can be ended. Once confirmation is
accepted, preparation and transaction writing are protected. A session whose preview
was ended shows a blocking notice naming the ending user; acknowledgement returns to
that account's transactions.

Run the real-API browser checks from `src/clutch-web`:

```powershell
npm run test:e2e:integration
```

This starts one disposable SQL Server container and HTTPS API, creates the test users
(owner, a second user and the bootstrapped administrator) and their saved sign-in state, and
runs every journey that needs a real backend. It needs Docker, the .NET SDK and ports 5173
and 7180. `npm run test:e2e` runs the browser specs that mock the API, and `npm run test:all`
runs every frontend suite. See the [validation guide](specs/011-validate-active-import/quickstart.md)
for focused backend/frontend checks, prerequisites and release gates.

Before deploying the additive `ActiveImportCoordination` migration, block import routes
briefly and drain in-flight requests. Apply the migration, deploy the coordinated
backend, then the frontend. Never run old cleanup workers alongside `Processing`
reviews. Old account-only end requests now fail explicitly: an exact review target
is required. Prefer forward recovery; binary rollback requires draining/recovering
processing attempts first and must preserve retained ending metadata and immutable
Audit records. See the [data model and rollout procedure](specs/011-validate-active-import/data-model.md).
