# Notification System Design

### Priority Inbox Implementation

This Stage 6 implementation uses the provided protected Notification API to fetch real notification payloads and select the top `n` notifications using a combination of:
- **Priority weight**: `Placement > Result > Event`
- **Recency**: newer notifications are ranked higher when the priority is equal

The code in `campus_notification_app/priorityInbox.js` is a working Node.js script that:
- reads the API endpoint `http://4.224.186.213/evaluation-service/notifications`
- requires an authentication token via environment variables
- sorts notifications by type weight and timestamp
- prints the top `n` notifications in a table

### Priority Model

Type weights:
- `Placement` = 3
- `Result` = 2
- `Event` = 1

The sort key is:
1. priority weight descending
2. timestamp descending

### Usage

Set the auth token in an environment variable and run:

```bash
NOTIF_API_TOKEN="<token>" node campus_notification_app/priorityInbox.js --top=10
```

Or if the API header name is custom:

```bash
NOTIF_API_HEADER="Authorization" NOTIF_API_TOKEN="<token>" node campus_notification_app/priorityInbox.js --top=10
```

If the API requires POST-based auth instead of a header, use:

```bash
NOTIF_API_TOKEN="<token>" node campus_notification_app/priorityInbox.js --http-method=POST --body-field=token --top=10
```

If the endpoint expects a full JSON body payload:

```bash
node campus_notification_app/priorityInbox.js --http-method=POST --body-json='{"token":"<token>"}' --top=10
```

### Real-time updates and efficiency

To keep the top notifications efficient as new notifications arrive:
- fetch only the required feed from the API instead of all student notifications on every page load
- maintain an in-memory sorted top `n` list for the current session
- use background polling or a push mechanism (WebSocket / server-sent events) to update the inbox when new notifications arrive

### Notes

- The app does not hard-code notifications locally.
- It works with the provided API contract and adapts to the protected route constraint.
- The code is designed as a small command-line utility, which can be expanded into a full backend or frontend component.
