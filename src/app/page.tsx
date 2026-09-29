import { requireUser } from "@/lib/dal";
import Dashboard from "@/components/dashboard/dashboard";
import UserMenu from "@/components/user-menu";

// "Yenilə" server action-u bu səhifənin funksiyasında işləyir — Apps Script-in Sheet-i oxuması vaxt aparır
export const maxDuration = 300;

export default async function AnalyticsPage() {
  const user = await requireUser();
  return (
    <>
      <header className="strip">
        <div className="wrap">
          <div className="logo"><i>SR</i>SR AUTO</div>
          <nav className="brands" id="brands" aria-label="Brend üzrə sürətli filtr" />
          <UserMenu user={{ name: user.name, email: user.email, role: user.role }} />
        </div>
      </header>
      <Dashboard isAdmin={user.role === "admin"} />
    </>
  );
}
