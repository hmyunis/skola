import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeStore } from "@/stores/themeStore";
import { useAuthStore, MOCK_ACCOUNTS } from "@/stores/authStore";
import { useClassroomStore } from "@/stores/classroomStore";
import { createClassroom, joinClassByCode } from "@/services/classrooms";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Lock, Sun, Moon, ArrowRight, ArrowLeft, Plus, Users,
  Crown, Shield, User, BookOpen, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Step = "choose" | "create" | "join" | "demo-pick";

const Onboarding = () => {
  const navigate = useNavigate();
  const { colorMode, toggleColorMode } = useThemeStore();
  const { login, user } = useAuthStore();
  const { setActiveClassroom } = useClassroomStore();
  const [step, setStep] = useState<Step>("choose");

  // Create form
  const [className, setClassName] = useState("");
  const [batch, setBatch] = useState("");
  const [year, setYear] = useState("3");
  const [semester, setSemester] = useState("2");

  // Join form
  const [classCode, setClassCode] = useState("");

  // If no user logged in, use demo accounts for now
  const ensureUser = () => {
    if (!user) {
      // Auto-login as a new mock user for demo
      const demoUser = { ...MOCK_ACCOUNTS[2], id: `u-${Date.now()}`, name: "New User", role: "student" as const };
      login(demoUser);
      return demoUser;
    }
    return user;
  };

  const handleCreate = () => {
    if (!className.trim() || !batch.trim()) {
      toast({ title: "Missing fields", description: "Please fill in the class name and batch.", variant: "destructive" });
      return;
    }
    const currentUser = ensureUser();
    // Upgrade user to owner
    const ownerUser = { ...currentUser, role: "owner" as const };
    login(ownerUser);

    const classroom = createClassroom(className.trim(), batch.trim(), parseInt(year), parseInt(semester), ownerUser.id);
    setActiveClassroom(classroom);
    toast({ title: "Class Created!", description: `Your class code is ${classroom.code}. Share it with classmates!` });
    navigate("/dashboard");
  };

  const handleJoin = () => {
    if (!classCode.trim()) {
      toast({ title: "Enter a code", description: "Please enter the class code shared by your class owner.", variant: "destructive" });
      return;
    }
    const currentUser = ensureUser();
    const result = joinClassByCode(classCode.trim().toUpperCase(), currentUser.id);
    if (!result.success) {
      toast({ title: "Could not join", description: result.error, variant: "destructive" });
      return;
    }
    setActiveClassroom(result.classroom!);
    toast({ title: "Joined!", description: `Welcome to ${result.classroom!.name}` });
    navigate("/dashboard");
  };

  const handleDemoLogin = (idx: number) => {
    login(MOCK_ACCOUNTS[idx]);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      {/* Theme toggle */}
      <button
        onClick={toggleColorMode}
        className="absolute top-4 right-4 p-2 border border-border bg-card hover:bg-accent transition-colors z-10"
        aria-label="Toggle color mode"
      >
        {colorMode === "light" ? <Moon className="h-4 w-4 text-foreground" /> : <Sun className="h-4 w-4 text-foreground" />}
      </button>

      {/* Grid bg */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }} />

      <div className="w-full max-w-md relative z-10">
        <AnimatePresence mode="wait">
          {/* ── CHOOSE ── */}
          {step === "choose" && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="text-center space-y-3">
                <div className="h-14 w-14 bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto">
                  <Lock className="h-7 w-7 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Welcome to</p>
                  <h1 className="text-2xl font-black uppercase tracking-wider">SKOLA</h1>
                </div>
                <p className="text-xs text-muted-foreground">Create a new class or join an existing one</p>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <button
                  onClick={() => setStep("create")}
                  className="w-full group border border-border bg-card p-5 hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-4 text-left"
                >
                  <div className="h-12 w-12 border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black uppercase tracking-wider text-foreground">Create a Class</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Start a new classroom and become the owner</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </button>

                <button
                  onClick={() => setStep("join")}
                  className="w-full group border border-border bg-card p-5 hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-4 text-left"
                >
                  <div className="h-12 w-12 border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black uppercase tracking-wider text-foreground">Join a Class</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Enter a class code to join as a student</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </button>
              </div>

              {/* Demo accounts */}
              <Card className="border-dashed">
                <CardContent className="p-4 space-y-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-center">
                    Quick Demo Login
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {MOCK_ACCOUNTS.map((account, idx) => {
                      const Icon = account.role === "owner" ? Crown : account.role === "admin" ? Shield : User;
                      return (
                        <button
                          key={account.id}
                          onClick={() => handleDemoLogin(idx)}
                          className="border border-border p-2 hover:bg-accent transition-colors text-center space-y-1"
                        >
                          <Icon className="h-4 w-4 mx-auto text-muted-foreground" />
                          <p className="text-[10px] font-bold truncate">{account.name.split(" ")[0]}</p>
                          <p className="text-[9px] text-muted-foreground uppercase">{account.role}</p>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <div className="text-center">
                <Link to="/" className="text-[10px] text-muted-foreground/50 uppercase tracking-widest hover:text-muted-foreground transition-colors">
                  ← Back to home
                </Link>
              </div>
            </motion.div>
          )}

          {/* ── CREATE ── */}
          {step === "create" && (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="h-12 w-12 bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-wider">Create Your Class</h2>
                <p className="text-xs text-muted-foreground">Set up your classroom and invite classmates</p>
              </div>

              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-bold">Class Name</Label>
                    <Input
                      placeholder="e.g. Software Engineering 2025"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-bold">Batch / Department</Label>
                    <Input
                      placeholder="e.g. Software, Electrical, Civil"
                      value={batch}
                      onChange={(e) => setBatch(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase tracking-widest font-bold">Year</Label>
                      <Select value={year} onValueChange={setYear}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((y) => (
                            <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase tracking-widest font-bold">Semester</Label>
                      <Select value={semester} onValueChange={setSemester}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2].map((s) => (
                            <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button onClick={handleCreate} className="w-full text-xs font-bold uppercase tracking-wider gap-2">
                    <Crown className="h-4 w-4" />
                    Create & Enter Class
                  </Button>
                </CardContent>
              </Card>

              <button
                onClick={() => setStep("choose")}
                className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors mx-auto"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
            </motion.div>
          )}

          {/* ── JOIN ── */}
          {step === "join" && (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="h-12 w-12 bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-black uppercase tracking-wider">Join a Class</h2>
                <p className="text-xs text-muted-foreground">Enter the code your class owner shared with you</p>
              </div>

              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-bold">Class Code</Label>
                    <Input
                      placeholder="e.g. A1B2C3"
                      value={classCode}
                      onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                      className="text-center text-lg font-mono tracking-[0.3em] uppercase"
                      maxLength={10}
                    />
                    <p className="text-[10px] text-muted-foreground text-center">
                      Ask your class owner for the 6-character code
                    </p>
                  </div>

                  <Button onClick={handleJoin} className="w-full text-xs font-bold uppercase tracking-wider gap-2">
                    <Users className="h-4 w-4" />
                    Join Class
                  </Button>
                </CardContent>
              </Card>

              <button
                onClick={() => setStep("choose")}
                className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors mx-auto"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Onboarding;
