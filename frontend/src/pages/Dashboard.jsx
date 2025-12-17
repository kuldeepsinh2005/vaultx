import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div>
      <h2>Dashboard</h2>

      <p>Welcome, <strong>{user?.username}</strong></p>
      <p>Email: {user?.email}</p>

      <button onClick={logout}>Logout</button>
    </div>
  );
};

export default Dashboard;
