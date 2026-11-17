// Loads sample notes + URLs through the running API: `npm run seed`
const API = process.env.API_URL ?? "http://localhost:4000";

const notes = [
  "Meeting with Ravi on Friday at 3 PM about the budget.",
  "Mom's birthday is March 14. She loves mangoes and old Hindi songs. Order the cake from Karachi Bakery by March 10.",
  "Gym plan: Mon chest, Tue back, Wed legs, Thu rest, Fri shoulders. Aim for 8k steps on rest days.",
  "Wifi password for the new flat is on the fridge. Landlord is Mr. Sharma, rent is due on the 5th of every month.",
  "Book ideas to read next: Atomic Habits, The Pragmatic Programmer, Deep Work. Finish Atomic Habits by end of month.",
  "Trip to Goa in December: flights booked for Dec 20, hotel near Baga beach, rent a scooter for 3 days.",
];

const urls = [
  "https://en.wikipedia.org/wiki/Hyderabadi_biryani",
  "https://en.wikipedia.org/wiki/Retrieval-augmented_generation",
  "https://en.wikipedia.org/wiki/Goa",
];

async function save(type: "note" | "url", content: string) {
  const res = await fetch(`${API}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, content }),
  });
  const body = await res.json();
  console.log(res.ok ? `ok   ${body.item.title}` : `FAIL ${content.slice(0, 40)} → ${body.error.message}`);
}

for (const n of notes) await save("note", n);
for (const u of urls) await save("url", u);
