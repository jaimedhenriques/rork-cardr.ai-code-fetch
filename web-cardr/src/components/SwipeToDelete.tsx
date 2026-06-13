import { useState, useRef } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Trash2 } from "lucide-react";

interface SwipeToDeleteProps {
  onDelete: () => void;
  children: React.ReactNode;
  className?: string;
}

const THRESHOLD = -80;

const SwipeToDelete = ({ onDelete, children, className = "" }: SwipeToDeleteProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [0, THRESHOLD], [0, 1]);
  const iconScale = useTransform(x, [0, THRESHOLD], [0.5, 1]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < THRESHOLD) {
      setIsDeleting(true);
      setTimeout(onDelete, 200);
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      {/* Delete background */}
      <motion.div
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 bg-destructive flex items-center justify-end pr-6 rounded-2xl"
      >
        <motion.div style={{ scale: iconScale }}>
          <Trash2 size={18} className="text-destructive-foreground" />
        </motion.div>
      </motion.div>

      {/* Draggable content */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        animate={isDeleting ? { x: -400, opacity: 0 } : undefined}
        transition={{ duration: 0.2 }}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default SwipeToDelete;
