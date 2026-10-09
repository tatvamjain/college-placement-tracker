import { CheckIn } from "@/components/CheckIn";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <section className="checkin">
      <div className="checkin-intro">
        <p className="kicker">Students &amp; placement cell</p>
        <h1 className="today-title">
          Sign <span>in</span>
        </h1>
        <p className="checkin-copy">
          Sign in with your college email. Admins go to the admin panel, where drives, rounds
          and results are updated.
        </p>
      </div>
      <CheckIn />
    </section>
  );
}
