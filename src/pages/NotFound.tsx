import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Animated 404 number */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 15, stiffness: 200 }}
          className="relative"
        >
          <span className="text-[10rem] sm:text-[12rem] font-black leading-none tracking-tighter text-primary/10 select-none block">
            404
          </span>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="p-4 border-2 border-dashed border-primary/30 bg-background/80 backdrop-blur-sm">
              <Search className="h-10 w-10 text-primary mx-auto mb-2" />
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary">
                Not Found
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <h1 className="text-xl font-black uppercase tracking-wider">
            Page Not Found
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The page at{" "}
            <code className="px-1.5 py-0.5 bg-muted border border-border text-xs font-mono">
              {location.pathname}
            </code>{" "}
            doesn't exist or has been moved.
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Button asChild size="sm" className="gap-2 w-full sm:w-auto">
            <Link to="/">
              <Home className="h-3.5 w-3.5" />
              Back to Dashboard
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 w-full sm:w-auto"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Go Back
          </Button>
        </motion.div>

        {/* Bottom branding */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50 pt-4"
        >
          SKOLA — Command Center
        </motion.p>
      </div>
    </div>
  );
};

export default NotFound;
