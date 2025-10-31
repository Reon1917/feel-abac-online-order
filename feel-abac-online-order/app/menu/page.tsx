import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AdminBar } from "@/components/admin/admin-bar";
import { MenuBrowser } from "@/components/menu/menu-browser";
import { PhoneEditModal } from "@/components/menu/phone-edit-modal";
import { getSession } from "@/lib/session";
import { getUserProfile } from "@/lib/user-profile";

const mockMenu = [
  {
    id: "app",
    name: "Appetizers",
    items: [
      {
        id: "tea-leaf-salad",
        name: "Tea Leaf Salad",
        description: "Fermented leaves, peanut crumble, citrus dressing.",
        price: 85,
        isVegetarian: true,
        emoji: "🥗",
        spiceLevel: 1,
      },
      {
        id: "crispy-samosa",
        name: "Crispy Samosa Trio",
        description: "Golden pastries with tamarind mint chutney.",
        price: 65,
        emoji: "🥟",
      },
    ],
  },
  {
    id: "mains",
    name: "Main Course",
    items: [
      {
        id: "mohinga",
        name: "Mohinga",
        description: "Traditional fish noodle soup with herbs and citrus.",
        price: 120,
        emoji: "🍲",
        isRecommended: true,
        spiceLevel: 2,
      },
      {
        id: "shan-noodles",
        name: "Shan Noodles",
        description: "Rice noodles with chicken in savoury tomato sauce.",
        price: 95,
        emoji: "🍜",
      },
      {
        id: "coconut-chicken-noodles",
        name: "Coconut Chicken Noodles",
        description: "Creamy coconut curry sauce with grilled chicken.",
        price: 110,
        emoji: "🍛",
        isRecommended: true,
        spiceLevel: 3,
      },
      {
        id: "burmese-curry",
        name: "Burmese Curry",
        description: "Slow-cooked beef with toasted spices and potato.",
        price: 140,
        emoji: "🍛",
        spiceLevel: 3,
      },
    ],
  },
  {
    id: "desserts",
    name: "Desserts",
    items: [
      {
        id: "sticky-rice-mango",
        name: "Sticky Rice with Mango",
        description: "Coconut-infused rice with ripe mango and sesame.",
        price: 75,
        emoji: "🥭",
        isVegetarian: true,
      },
      {
        id: "coconut-panna-cotta",
        name: "Coconut Panna Cotta",
        description: "Silky coconut custard with kaffir lime.",
        price: 85,
        emoji: "🍮",
      },
    ],
  },
  {
    id: "drinks",
    name: "Drinks",
    items: [
      {
        id: "thai-iced-tea",
        name: "Thai Iced Tea",
        description: "Sweet condensed milk, slow-brewed black tea.",
        price: 45,
        emoji: "🧋",
      },
      {
        id: "lemongrass-soda",
        name: "Lemongrass Iced Soda",
        description: "House-made syrup, fizz, and lime.",
        price: 40,
        emoji: "🥤",
        isVegetarian: true,
      },
    ],
  },
];

export default async function MenuPage() {
  noStore();

  const sessionData = await getSession();
  if (!sessionData?.session?.user) {
    redirect("/");
  }

  const profile = await getUserProfile(sessionData.session.user.id);
  if (!profile) {
    redirect("/onboarding");
  }

  return (
    <>
      {sessionData.isAdmin && <AdminBar />}
      <main className="min-h-screen w-full bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-14 sm:px-10 lg:px-12">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                Welcome back, {sessionData.session.user.name || "guest"} 👋
              </h1>
              <p className="text-sm text-slate-600 flex items-center gap-1">
                Reachable at{" "}
                <strong className="font-semibold text-slate-800">
                  {profile.phoneNumber}
                </strong>
                <PhoneEditModal currentPhone={profile.phoneNumber} />
              </p>
            </div>
            <SignOutButton />
          </header>

          <MenuBrowser categories={mockMenu} />
        </div>
      </main>
    </>
  );
}
