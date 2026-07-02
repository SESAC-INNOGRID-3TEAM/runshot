import apiClient from "./client";
import { USE_MOCK } from "./useMock";
import { MOCK_EVENTS, MOCK_PHOTOS_BY_EVENT, MOCK_UNRECOGNIZED_BY_EVENT, delay } from "./mockData";

export async function fetchEvents() {
  if (USE_MOCK) {
    await delay();
    return MOCK_EVENTS;
  }
  const res = await apiClient.get("/events");
  return res.data;
}

export async function fetchEvent(id) {
  if (USE_MOCK) {
    await delay();
    const event = MOCK_EVENTS.find((e) => String(e.id) === String(id));
    if (!event) throw new Error("event not found");
    return event;
  }
  const res = await apiClient.get(`/events/${id}`);
  return res.data;
}

export async function createEvent(payload) {
  if (USE_MOCK) {
    await delay();
    const newEvent = {
      id: Math.max(...MOCK_EVENTS.map((e) => e.id)) + 1,
      ...payload,
      photo_summary: { total: 0, done: 0, unrecognized: 0 },
      bibs: [],
    };
    MOCK_EVENTS.unshift(newEvent);
    MOCK_PHOTOS_BY_EVENT[newEvent.id] = [];
    MOCK_UNRECOGNIZED_BY_EVENT[newEvent.id] = [];
    return newEvent;
  }
  const res = await apiClient.post("/events", payload);
  return res.data;
}

export async function updateEvent(id, payload) {
  if (USE_MOCK) {
    await delay();
    const event = MOCK_EVENTS.find((e) => String(e.id) === String(id));
    if (!event) throw new Error("event not found");
    Object.assign(event, payload);
    return event;
  }
  const res = await apiClient.put(`/events/${id}`, payload);
  return res.data;
}
