import { motion } from "framer-motion";

interface Testimonial {
  text: string;
  image: string;
  name: string;
  role: string;
}

const testimonials: Testimonial[] = [
  {
    text: "Cardr replaced three apps for me. Scan a badge, the contact is enriched, in my pipeline, and synced to HubSpot before I leave the booth.",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200&h=200",
    name: "Briana Patton",
    role: "Head of Sales, Northwind",
  },
  {
    text: "The AI note taker writes my recap, extracts action items and drafts the follow-up email. I close 2 hours of admin every day.",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200&h=200",
    name: "Bilal Ahmed",
    role: "Account Executive, Linear",
  },
  {
    text: "Best digital business card I've used. Calendar, LinkedIn, booking link — all in one tap. People remember me now.",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200&h=200",
    name: "Saman Malik",
    role: "Partnerships Lead, Notion",
  },
  {
    text: "Contact enrichment is uncanny. I scan a card and 30 seconds later I know their company size, funding stage and recent news.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200&h=200",
    name: "Omar Raza",
    role: "Founder, Stride",
  },
  {
    text: "The Proposal Builder agent writes a fully branded proposal in 40 seconds. My logo, my colors, my voice. It's witchcraft.",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200&h=200",
    name: "Zainab Hussain",
    role: "Agency Owner, Field Studio",
  },
  {
    text: "Synced 4,000 contacts from a trade show in a weekend. Pipeline got reorganised by AI, calendar is full of qualified meetings.",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200&h=200",
    name: "Aliza Khan",
    role: "Growth Lead, Atlas Logistics",
  },
  {
    text: "I run a 12-person sales team on Cardr. Real-time sync across devices, role-based access, branded cards — it just works.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200&h=200",
    name: "Farhan Siddiqui",
    role: "VP Sales, Vector",
  },
  {
    text: "I haven't typed a contact into a CRM in 6 months. The scanner is faster than typing. Every conference now feels effortless.",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200&h=200",
    name: "Sana Sheikh",
    role: "Enterprise AE, Ramp",
  },
  {
    text: "The AI chat answers questions about my pipeline like a chief of staff. 'Who haven't I followed up with this week?' — instant answer.",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200&h=200",
    name: "Hassan Ali",
    role: "Solo Consultant",
  },
];

const firstColumn = testimonials.slice(0, 3);
const secondColumn = testimonials.slice(3, 6);
const thirdColumn = testimonials.slice(6, 9);

const TestimonialsColumn = ({
  className = "",
  testimonials,
  duration = 18,
}: {
  className?: string;
  testimonials: Testimonial[];
  duration?: number;
}) => (
  <div className={className}>
    <motion.div
      animate={{ y: ["0%", "-50%"] }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
      className="flex flex-col gap-6 pb-6"
    >
      {[...Array(2)].map((_, dup) => (
        <div key={dup} className="flex flex-col gap-6">
          {testimonials.map(({ text, image, name, role }, i) => (
            <div
              key={`${dup}-${i}`}
              className="rounded-2xl border border-border/60 bg-card/60 p-6 shadow-[0_1px_0_0_hsl(var(--foreground)/0.04)_inset] backdrop-blur-sm"
            >
              <p className="text-sm leading-relaxed text-foreground/90">"{text}"</p>
              <div className="mt-5 flex items-center gap-3">
                <img
                  src={image}
                  alt={name}
                  className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
                  loading="lazy"
                />
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-foreground">{name}</span>
                  <span className="text-xs text-muted-foreground">{role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </motion.div>
  </div>
);

const TestimonialsSection = () => (
  <section className="relative overflow-hidden border-t border-border/50 bg-secondary/30 py-24">
    {/* ambient glow */}
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.08),transparent)]" />

    <div className="relative mx-auto max-w-6xl px-6">
      <div className="mx-auto max-w-2xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Testimonials
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mt-5 text-balance text-4xl font-bold tracking-tight md:text-5xl"
        >
          Loved by people who close
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-4 text-base text-muted-foreground md:text-lg"
        >
          Sales teams, founders and consultants use Cardr to turn every handshake into pipeline.
        </motion.p>
      </div>

      <div className="relative mt-14 grid max-h-[640px] grid-cols-1 gap-6 overflow-hidden md:grid-cols-2 lg:grid-cols-3 [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]">
        <TestimonialsColumn testimonials={firstColumn} duration={22} />
        <TestimonialsColumn testimonials={secondColumn} duration={28} className="hidden md:block" />
        <TestimonialsColumn testimonials={thirdColumn} duration={25} className="hidden lg:block" />
      </div>
    </div>
  </section>
);

export default TestimonialsSection;
