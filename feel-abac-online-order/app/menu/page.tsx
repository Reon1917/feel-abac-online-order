import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getCurrentSession } from "@/lib/session";
import { getUserProfile } from "@/lib/user-profile";

const sampleMenu = [
  {
    category: "Signature Rice",
    items: [
      { name: "Garlic pork rice", price: "65 THB" },
      { name: "Crispy basil chicken rice", price: "70 THB" },
    ],
  },
  {
    category: "Noodle Bowls",
    items: [
      { name: "Tom yum noodle soup", price: "75 THB" },
      { name: "Tokyo yakisoba", price: "70 THB" },
    ],
  },
  {
    category: "Drink Bar",
    items: [
      { name: "Thai iced tea", price: "35 THB" },
      { name: "Lemongrass iced soda", price: "40 THB" },
    ],
  },
];

export default async function MenuPage() {
  noStore();

  const session = await getCurrentSession();
  if (!session?.user) {
    redirect("/");
  }

  const profile = await getUserProfile(session.user.id);
  if (!profile) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-14 sm:px-10 lg:px-16">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Welcome back, {session.user.name || "guest"} 👋
          </h1>
          <p className="text-sm text-slate-600">
            Contact number on file:{" "}
            <strong className="font-semibold text-slate-800">
              {profile.phoneNumber}
            </strong>
            . Update it anytime from onboarding.
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className="grid gap-6 rounded-3xl border border-slate-100 bg-emerald-50/70 p-6 text-slate-900 shadow-sm">
        <h2 className="text-xl font-semibold">Today&apos;s highlights</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {sampleMenu.map((section) => (
            <div
              key={section.category}
              className="rounded-2xl border border-emerald-100 bg-white p-5"
            >
              <h3 className="text-lg font-semibold text-emerald-900">
                {section.category}
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {section.items.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between"
                  >
                    <span>{item.name}</span>
                    <span className="font-medium text-emerald-800">
                      {item.price}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          What&apos;s next for Feel ABAC?
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Menu management dashboard for restaurant admins</li>
          <li>Order status timeline with kitchen updates</li>
          <li>Pickup windows to reduce lunchtime bottlenecks</li>
          <li>Automated order throttling when the kitchen gets busy</li>
        </ul>
      </section>
    </main>
  );
}
