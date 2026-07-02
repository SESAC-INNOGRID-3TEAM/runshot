import apiClient from "./client";
import { USE_MOCK } from "./useMock";
import { MOCK_USERS, MOCK_EVENTS, delay } from "./mockData";

export async function fetchUsers() {
  if (USE_MOCK) {
    await delay();
    return MOCK_USERS;
  }
  const res = await apiClient.get("/admin/users");
  return res.data.users;
}

export async function updateUserRole(userId, role) {
  if (USE_MOCK) {
    await delay();
    const user = MOCK_USERS.find((u) => u.id === userId);
    if (user) user.role = role;
    return user;
  }
  const res = await apiClient.patch(`/admin/users/${userId}/role`, { role });
  return res.data;
}

export async function deleteEvent(eventId) {
  if (USE_MOCK) {
    await delay();
    const idx = MOCK_EVENTS.findIndex((e) => e.id === eventId);
    if (idx >= 0) MOCK_EVENTS.splice(idx, 1);
    return;
  }
  await apiClient.delete(`/events/${eventId}`);
}
