import { CheckIn } from "@/components/CheckIn";

export const metadata = { title: "Check-in" };

export default function LoginPage() {
  return (
    <section className="checkin">
      <div className="checkin-intro">
        <p className="kicker">Passenger &amp; crew check-in</p>
        <h1 className="today-title">
          Check<span>-in</span>
        </h1>
        <p className="checkin-copy">
          Sign in with your Thapar email. Admins land in the control tower, where drives, rounds
          and results are updated.
        </p>
      </div>
      <CheckIn />
    </section>
  );
}
