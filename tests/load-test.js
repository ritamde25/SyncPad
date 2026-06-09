import ws from "k6/ws";
import { check } from "k6";
import exec from "k6/execution";
import { Trend, Rate } from "k6/metrics";

const wsConnectTime = new Trend("ws_connect_time", true);
const wsInitTime = new Trend("ws_init_time", true);
const wsOpAckTime = new Trend("ws_op_ack_time", true);
const opAckSuccessRate = new Rate("op_ack_success_rate");

const BASE_URL = __ENV.BASE_URL || "https://syncpad-mvpu.onrender.com";
const WS_URL = BASE_URL.replace(/^http/, "ws");
const DOC_ID = __ENV.DOC_ID || "shared-load-test-doc";

const TARGET_VUS = 100;
const SESSION_DURATION_MS = 45_000;
const THINK_MIN_MS = 800;
const THINK_MAX_MS = 1800;
const ACK_TIMEOUT_MS = 6_000;

const INSERT_TOKENS = [
  "a",
  "e",
  "i",
  "o",
  "u",
  " ",
  "th",
  "re",
  "ion",
  "-",
  ", ",
  ". ",
];

export const options = {
  scenarios: {
    warmup: {
      executor: "constant-vus",
      vus: 1,
      duration: "20s",
      exec: "collabWs",
    },
    collab_ws: {
      executor: "constant-vus",
      vus: TARGET_VUS,
      startTime: "20s",
      duration: "3m",
      gracefulStop: "15s",
      exec: "collabWs",
    },
  },
  thresholds: {
    checks: ["rate>0.99"],
    ws_connect_time: ["p(95)<2500"],
    ws_init_time: ["p(95)<3000"],
    ws_op_ack_time: ["p(95)<250"],
    op_ack_success_rate: ["rate>0.99"],
  },
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randChoice(values) {
  return values[randInt(0, values.length - 1)];
}

function extractAckOpId(message) {
  if (message.type === "operation_ack" && message.opId) {
    return message.opId;
  }

  if (message.type === "ack" && message.opId) {
    return message.opId;
  }

  if (message.type === "operation" && message.operation?.opId) {
    return message.operation.opId;
  }

  return null;
}

function extractVersion(message) {
  if (typeof message.version === "number") {
    return message.version;
  }

  if (typeof message.operation?.version === "number") {
    return message.operation.version;
  }

  return null;
}

function buildInsertOperation(clientId, iteration, version, cursorPosition) {
  const text = randChoice(INSERT_TOKENS);
  const opId = `op-${clientId}-${__ITER}-${iteration}-${Date.now()}`;

  return {
    type: "insert",
    pos: Math.max(0, cursorPosition),
    text,
    clientId,
    opId,
    version,
  };
}

export default collabWs;

export function collabWs() {
  const recordMetrics = exec.scenario.name === "collab_ws";
  const clientId = `k6-vu-${__VU}`;
  const connectStartedAt = Date.now();
  let joined = false;
  let wsWasUpgraded = false;

  const res = ws.connect(WS_URL, {}, (socket) => {
    const pendingOps = new Map();

    let closed = false;
    let docVersion = 0;
    let opIteration = 0;
    let cursorPosition = 0;
    let initMeasured = false;

    function clearPending(opId) {
      pendingOps.delete(opId);
    }

    function markAck(opId) {
      const sentAt = pendingOps.get(opId);
      if (!sentAt) {
        return;
      }

      if (recordMetrics) {
        wsOpAckTime.add(Date.now() - sentAt);
        opAckSuccessRate.add(true);
      }

      clearPending(opId);
    }

    function scheduleNextAction() {
      if (closed) {
        return;
      }

      const delayMs = randInt(THINK_MIN_MS, THINK_MAX_MS);
      socket.setTimeout(() => {
        if (closed || !joined) {
          scheduleNextAction();
          return;
        }

        const operation = buildInsertOperation(clientId, opIteration, docVersion, cursorPosition);
        pendingOps.set(operation.opId, Date.now());

        socket.send(
          JSON.stringify({
            type: "operation",
            docId: DOC_ID,
            operation,
          })
        );

        cursorPosition += operation.text.length;

        socket.setTimeout(() => {
          if (!pendingOps.has(operation.opId) || closed) {
            return;
          }

          if (recordMetrics) {
            opAckSuccessRate.add(false);
          }
          clearPending(operation.opId);
        }, ACK_TIMEOUT_MS);
        opIteration += 1;

        scheduleNextAction();
      }, delayMs);
    }

    socket.on("open", () => {
      if (recordMetrics) {
        wsConnectTime.add(Date.now() - connectStartedAt);
      }

      socket.send(
        JSON.stringify({
          type: "join",
          docId: DOC_ID,
          clientId,
        })
      );

      scheduleNextAction();
    });

    socket.on("message", (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage);

        if (message.type === "init" || message.type === "joined") {
          joined = true;
          if (!initMeasured && recordMetrics) {
            wsInitTime.add(Date.now() - connectStartedAt);
            initMeasured = true;
          }
          const version = extractVersion(message);
          if (version !== null) {
            docVersion = version;
          }
          return;
        }

        const version = extractVersion(message);
        if (version !== null) {
          docVersion = version;
        }

        const ackOpId = extractAckOpId(message);
        if (ackOpId !== null) {
          markAck(ackOpId);
        }
      } catch (_error) {
        // Ignore malformed messages in this minimal benchmark.
      }
    });

    socket.on("close", () => {
      closed = true;

      for (const _opId of pendingOps.keys()) {
        if (recordMetrics) {
          opAckSuccessRate.add(false);
        }
      }
      pendingOps.clear();
    });

    socket.setTimeout(() => {
      if (!closed) {
        socket.close();
      }
    }, SESSION_DURATION_MS);
  });

  if (recordMetrics) {
    check(res, {
      "ws upgraded": (r) => r && r.status === 101,
    });
  }
  wsWasUpgraded = !!(res && res.status === 101);

  if (recordMetrics) {
    check(
      { joined, wsWasUpgraded },
      {
        "joined after connect": (d) => d.joined,
        "ws upgraded and joined": (d) => d.wsWasUpgraded && d.joined,
      }
    );
  }
}