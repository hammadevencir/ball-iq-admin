import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayoutShell from "@/components/AdminLayoutShell";

export default function AdminLayout({ children }) {
  return (
    <ProtectedRoute>
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </ProtectedRoute>
  );
}
