import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { fetchUsers, updateUserRole, deleteEvent } from "../api/admin";
import { fetchEvents } from "../api/events";
import PageContainer from "../components/common/PageContainer";
import Spinner from "../components/common/Spinner";
import { formatEventDate } from "../utils/formatDate";
import styles from "./AdminPage.module.css";

const ROLES = ["participant", "photographer", "organizer", "admin"];

// 화면 표시용 라벨. 서버/DB는 영어 role 값을 그대로 사용하므로 value는 바꾸지 않는다.
const ROLE_LABELS = {
  participant: "참가자",
  photographer: "사진작가",
  organizer: "주최자",
  admin: "관리자",
};

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(false);

  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState(false);

  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .catch(() => setUsersError(true))
      .finally(() => setUsersLoading(false));

    fetchEvents()
      .then(setEvents)
      .catch(() => setEventsError(true))
      .finally(() => setEventsLoading(false));
  }, []);

  const handleRoleChange = async (userId, role) => {
    const prev = users;
    setUsers((current) => current.map((u) => (u.id === userId ? { ...u, role } : u)));
    try {
      await updateUserRole(userId, role);
      toast.success("역할이 변경되었습니다.");
    } catch {
      setUsers(prev);
      toast.error("역할 변경에 실패했습니다.");
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm("이 이벤트와 연결된 모든 사진/태그가 함께 삭제됩니다. 계속하시겠습니까?")) {
      return;
    }
    try {
      await deleteEvent(eventId);
      setEvents((current) => current.filter((e) => e.id !== eventId));
      toast.success("이벤트가 삭제되었습니다.");
    } catch {
      toast.error("이벤트 삭제에 실패했습니다.");
    }
  };

  return (
    <PageContainer>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>사용자 관리</h2>
        {usersLoading && <Spinner />}
        {!usersLoading && usersError && <p className={styles.stateText}>사용자 목록을 불러오지 못했습니다.</p>}
        {!usersLoading && !usersError && users.length === 0 && (
          <p className={styles.empty}>등록된 사용자가 없습니다.</p>
        )}
        {!usersLoading && !usersError && users.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>이메일</th>
                <th>가입일</th>
                <th>역할</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{formatEventDate(user.created_at)}</td>
                  <td>
                    <select
                      className={styles.roleSelect}
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>이벤트 관리</h2>
        {eventsLoading && <Spinner />}
        {!eventsLoading && eventsError && <p className={styles.stateText}>이벤트 목록을 불러오지 못했습니다.</p>}
        {!eventsLoading && !eventsError && events.length === 0 && (
          <p className={styles.empty}>등록된 이벤트가 없습니다.</p>
        )}
        {!eventsLoading && !eventsError && events.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>이름</th>
                <th>날짜</th>
                <th>장소</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{event.name}</td>
                  <td>{formatEventDate(event.event_date)}</td>
                  <td>{event.location}</td>
                  <td>
                    <Link className={styles.manageLink} to={`/admin/events/${event.id}/photos`}>
                      사진 관리
                    </Link>
                  </td>
                  <td>
                    <button className={styles.deleteButton} onClick={() => handleDeleteEvent(event.id)}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </PageContainer>
  );
}
