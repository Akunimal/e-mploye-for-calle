const CREDENTIAL_PATTERNS = [
  /\b(?:password|passcode|api[_ -]?key|secret|token|pin)\b/i,
  /\b(?:bank account|routing number|card number|cvv|iban|cbu|cvu)\b/i,
];

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/i,
  /forget\s+(?:all\s+)?(?:previous|prior)\s+instructions/i,
  /override\s+(?:your|all)\s+(?:rules|instructions|safety)/i,
];

export const isE164 = (value) => /^\+[1-9]\d{7,14}$/.test(String(value || ""));

export const maskPhone = (value) => {
  const phone = String(value || "");
  if (phone.length < 7) return "••••";
  return `${phone.slice(0, 4)}${"•".repeat(Math.max(2, phone.length - 7))}${phone.slice(-3)}`;
};

const block = (reason) => ({ ok: false, reason });

export const evaluateCallSafety = ({
  employee,
  task,
  managerApproved = false,
  idempotencyKey,
  recurring = false,
}) => {
  if (!employee || !isE164(employee.phone)) return block("safety:invalid_e164_phone");
  if (!managerApproved) return block("safety:manager_approval_required");
  if (!idempotencyKey) return block("safety:idempotency_key_required");
  if (!String(task || "").trim()) return block("safety:empty_call_task");
  if (String(task).length > 4000) return block("safety:call_task_too_long");
  if (recurring) return block("safety:recurring_calls_not_supported");
  if (CREDENTIAL_PATTERNS.some((pattern) => pattern.test(task))) return block("safety:sensitive_data_in_task");
  if (INJECTION_PATTERNS.some((pattern) => pattern.test(task))) return block("safety:injection_like_task");
  return { ok: true, reason: "safety:passed" };
};

export const sanitizeError = (error) => {
  const message = error instanceof Error ? error.message : "Unknown provider error";
  return message.replace(/\+\d{8,15}/g, "[phone masked]").slice(0, 500);
};
