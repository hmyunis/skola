import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useThemeStore } from "@/stores/themeStore";
import {
  Shield, Lock, Users, BookOpen, MessageSquare, BarChart3,
  ArrowRight, Sun, Moon, Zap, Eye, Globe, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ── Feature data ── */
const FEATURES = [
  {
    icon: Users,
    title: "Multi-Tenant Classes",
    desc: "Each classroom is fully isolated. Your data, your rules, your privacy.",
  },
  {
    icon: BookOpen,
    title: "Academic Hub",
    desc: "Courses, schedules, resources, and assessments — all in one place.",
  },
  {
    icon: MessageSquare,
    title: "Anonymous Lounge",
    desc: "Students speak freely with identity-protected discussions and polls.",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    desc: "Owner, Admin, Student — granular permissions with zero overlap.",
  },
  {
    icon: BarChart3,
    title: "Live Analytics",
    desc: "Real-time insights on engagement, attendance, and academic progress.",
  },
  {
    icon: Zap,
    title: "Telegram Integration",
    desc: "Broadcast announcements and authenticate via Telegram bots.",
  },
];

/* ── Animated feature card ── */
function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const Icon = feature.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group border border-border bg-card p-6 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300"
    >
      <div className="h-10 w-10 border border-primary/30 bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="text-sm font-black uppercase tracking-wider mb-2 text-foreground">
        {feature.title}
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {feature.desc}
      </p>
    </motion.div>
  );
}

/* ── Stat counter ── */
function StatBlock({ value, label }: { value: string; label: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ type: "spring", damping: 20 }}
      className="text-center"
    >
      <p className="text-4xl md:text-5xl font-black text-primary tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-1">{label}</p>
    </motion.div>
  );
}

/* ── Main Landing ── */
const Landing = () => {
  const { colorMode, toggleColorMode } = useThemeStore();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 100]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Lock className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-black uppercase tracking-[0.2em]">SKOLA</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleColorMode}
              className="p-2 border border-border hover:bg-accent transition-colors"
              aria-label="Toggle theme"
            >
              {colorMode === "light" ? (
                <Moon className="h-4 w-4 text-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-foreground" />
              )}
            </button>
            <Link to="/login">
              <Button variant="outline" size="sm" className="text-xs font-bold uppercase tracking-wider">
                Sign In
              </Button>
            </Link>
            <Link to="/get-started">
              <Button size="sm" className="text-xs font-bold uppercase tracking-wider">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, y: heroY }}
        className="relative min-h-screen flex items-center justify-center pt-14"
      >
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center space-y-8">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-4 py-1.5"
          >
            <Eye className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
              Multi-Tenant Classroom Platform
            </span>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, type: "spring", damping: 20 }}
            className="space-y-4"
          >
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-[0.9]">
              Your Class.
              <br />
              <span className="text-primary">Your Rules.</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              The command center for student communities. Manage courses, resources, 
              discussions, and assessments — with military-grade isolation between every classroom.
            </p>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link to="/get-started">
              <Button size="lg" className="text-sm font-bold uppercase tracking-wider px-8 gap-2">
                Create Your Class
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" size="lg" className="text-sm font-bold uppercase tracking-wider px-8 gap-2">
                See Features
                <ChevronDown className="h-4 w-4" />
              </Button>
            </a>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center justify-center gap-8 sm:gap-16 pt-8 border-t border-border/50"
          >
            <StatBlock value="100%" label="Privacy" />
            <div className="h-8 w-px bg-border" />
            <StatBlock value="0" label="Data Leaks" />
            <div className="h-8 w-px bg-border" />
            <StatBlock value="∞" label="Classes" />
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <ChevronDown className="h-5 w-5 text-muted-foreground/50" />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ── Features ── */}
      <section id="features" className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-4 space-y-16">
          <div className="text-center space-y-3">
            <p className="text-[10px] uppercase tracking-[0.4em] text-primary font-bold">
              What You Get
            </p>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider">
              Built for Students,
              <br />
              <span className="text-muted-foreground">by Students</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} feature={f} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24 md:py-32 border-t border-border/50 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 space-y-16">
          <div className="text-center space-y-3">
            <p className="text-[10px] uppercase tracking-[0.4em] text-primary font-bold">
              3 Steps
            </p>
            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-wider">
              Get Running in Minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Sign Up", desc: "Create your account and become the owner of your classroom." },
              { step: "02", title: "Invite", desc: "Share a join link or Telegram bot — classmates join instantly." },
              { step: "03", title: "Command", desc: "Manage courses, post resources, run polls, and track everything." },
            ].map((s, i) => {
              const ref = useRef(null);
              const isInView = useInView(ref, { once: true, margin: "-40px" });
              return (
                <motion.div
                  key={s.step}
                  ref={ref}
                  initial={{ opacity: 0, x: -30 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: i * 0.15, duration: 0.5 }}
                  className="relative pl-6 border-l-2 border-primary/20"
                >
                  <span className="text-5xl font-black text-primary/10 absolute -left-1 -top-2 select-none">
                    {s.step}
                  </span>
                  <div className="pt-10 space-y-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                      {s.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 md:py-32">
        <div className="max-w-3xl mx-auto px-4 text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", damping: 20 }}
            className="space-y-4"
          >
            <Globe className="h-10 w-10 text-primary mx-auto" />
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-wider leading-tight">
              Ready to Take
              <br />
              <span className="text-primary">Command?</span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Create your isolated classroom in under 60 seconds. 
              Free for students, forever.
            </p>
          </motion.div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/get-started">
              <Button size="lg" className="text-sm font-bold uppercase tracking-wider px-10 gap-2">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Lock className="h-3 w-3 text-primary" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">
              SKOLA
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">
            © {new Date().getFullYear()} SKOLA · Privacy-First Education Platform
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
