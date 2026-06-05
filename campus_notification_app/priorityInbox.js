const API_URL = 'http://4.224.186.213/evaluation-service/notifications';
const DEFAULT_TOP_N = 10;

const PRIORITY_WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { top: DEFAULT_TOP_N, httpMethod: 'GET' };

  for (const arg of args) {
    if (arg.startsWith('--top=')) {
      options.top = Number(arg.split('=')[1]) || DEFAULT_TOP_N;
      continue;
    }

    if (arg.startsWith('--auth-header=')) {
      options.authHeader = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--auth-token=') || arg.startsWith('--auth-value=')) {
      options.authValue = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--auth-prefix=')) {
      options.authPrefix = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--http-method=')) {
      options.httpMethod = arg.split('=')[1].toUpperCase();
      continue;
    }

    if (arg.startsWith('--body-field=')) {
      options.bodyField = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--body-json=')) {
      options.bodyJson = arg.split('=')[1];
      continue;
    }
  }

  options.authHeader = options.authHeader || process.env.NOTIF_API_HEADER || 'Authorization';
  options.authValue = options.authValue || process.env.NOTIF_API_TOKEN || process.env.NOTIF_API_AUTH || process.env.AUTHORIZATION;

  if (options.authPrefix && options.authValue) {
    options.authValue = `${options.authPrefix} ${options.authValue}`;
  }

  return options;
}

function getNotificationScore(notification) {
  const weight = PRIORITY_WEIGHT[notification.Type] ?? 0;
  const time = Date.parse(notification.Timestamp);
  return {
    weight,
    timestamp: Number.isNaN(time) ? 0 : time,
  };
}

function sortNotifications(notifications) {
  return notifications.slice().sort((a, b) => {
    const aScore = getNotificationScore(a);
    const bScore = getNotificationScore(b);

    if (bScore.weight !== aScore.weight) {
      return bScore.weight - aScore.weight;
    }

    return bScore.timestamp - aScore.timestamp;
  });
}

function renderNotifications(notifications, top) {
  const selected = notifications.slice(0, top);
  const rows = selected.map((notification, index) => {
    const score = getNotificationScore(notification);
    const date = new Date(notification.Timestamp);
    const timestamp = Number.isNaN(date.getTime()) ? notification.Timestamp : date.toISOString();
    return {
      rank: index + 1,
      ID: notification.ID,
      Type: notification.Type,
      Message: notification.Message,
      Timestamp: timestamp,
      Priority: score.weight,
    };
  });

  console.table(rows);
}

async function fetchNotifications(url, options) {
  const headers = {
    'Content-Type': 'application/json',
  };

  const init = {
    method: options.httpMethod,
    headers,
  };

  if (options.authValue && options.httpMethod === 'GET') {
    headers[options.authHeader] = options.authValue;
  }

  if (options.httpMethod === 'POST') {
    if (options.bodyJson) {
      init.body = options.bodyJson;
    } else if (options.bodyField && options.authValue) {
      init.body = JSON.stringify({ [options.bodyField]: options.authValue });
    } else if (options.authValue) {
      init.body = JSON.stringify({ auth: options.authValue });
    }
  }

  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Fetch failed: ${response.status} ${response.statusText} - ${body}`);
  }

  return response.json();
}

async function main() {
  const options = parseArgs();
  const top = Number.isInteger(options.top) && options.top > 0 ? options.top : DEFAULT_TOP_N;

  if (!options.authValue) {
    console.error('Missing authentication token. Set NOTIF_API_TOKEN or NOTIF_API_AUTH or AUTHORIZATION in your environment.');
    process.exit(1);
  }

  console.log(`Fetching notifications from ${API_URL}`);
  console.log(`HTTP method: ${options.httpMethod}`);
  console.log(`Using auth header: ${options.authHeader}`);
  if (options.httpMethod === 'POST') {
    if (options.bodyJson) {
      console.log(`Sending auth data as JSON body`);
    } else if (options.bodyField) {
      console.log(`Sending auth token in POST body field: ${options.bodyField}`);
    } else {
      console.log(`Sending auth token in POST body under key: auth`);
    }
  }
  console.log(`Selecting top ${top} notifications by priority + recency.`);

  const payload = await fetchNotifications(API_URL, options);
  const notifications = Array.isArray(payload.notifications) ? payload.notifications : payload;

  if (!Array.isArray(notifications) || notifications.length === 0) {
    console.log('No notifications found.');
    return;
  }

  const sorted = sortNotifications(notifications);
  renderNotifications(sorted, top);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
