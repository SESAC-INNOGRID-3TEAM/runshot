import apiClient from "./client";
import { USE_MOCK } from "./useMock";
import { MOCK_USERS, delay } from "./mockData";

// 목 모드에서는 이메일에 role 이름을 포함해 로그인하면 해당 역할로 로그인된다.
// 예: organizer@runshot.dev, photo@runshot.dev, admin@runshot.dev, 그 외는 participant.
function resolveMockRole(email) {
  const known = MOCK_USERS.find((u) => u.email === email);
  if (known) return known.role;
  if (email.includes("admin")) return "admin";
  if (email.includes("organizer")) return "organizer";
  if (email.includes("photo")) return "photographer";
  return "participant";
}

export async function login(email, password) {
  if (USE_MOCK) {
    await delay();
    const role = resolveMockRole(email);
    return {
      user: { id: 999, email, role },
      access_token: "mock-token",
    };
  }
  const res = await apiClient.post("/auth/login", { email, password });
  return res.data;
}

export async function signup(email, password, role = "participant") {
  if (USE_MOCK) {
    await delay();
    return { id: 999, email, role };
  }
  const res = await apiClient.post("/auth/signup", { email, password, role });
  return res.data;
}
