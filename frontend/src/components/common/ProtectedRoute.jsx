import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

const ROLE_LEVEL = {
  participant: 0,
  photographer: 1,
  organizer: 2,
  admin: 3,
};

export default function ProtectedRoute({ minRole = "participant", children }) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userLevel = ROLE_LEVEL[user.role] ?? -1;
  const requiredLevel = ROLE_LEVEL[minRole] ?? 0;

  if (userLevel < requiredLevel) {
    return <Navigate to="/" replace />;
  }

  return children;
}
