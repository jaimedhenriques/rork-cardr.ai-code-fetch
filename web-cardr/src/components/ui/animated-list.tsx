import { ReactNode } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

interface AnimatedListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  itemClassName?: string;
  staggerDelay?: number;
}

/**
 * Staggered entrance list with smooth layout transitions on add/remove/reorder.
 * Pairs perfectly with iOS-style cards.
 */
function AnimatedList<T>({
  items,
  getKey,
  renderItem,
  className = "",
  itemClassName = "",
  staggerDelay = 0.04,
}: AnimatedListProps<T>) {
  return (
    <LayoutGroup>
      <div className={className}>
        <AnimatePresence initial={true} mode="popLayout">
          {items.map((item, i) => (
            <motion.div
              key={getKey(item)}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: {
                  duration: 0.45,
                  ease: [0.16, 1, 0.3, 1],
                  delay: i * staggerDelay,
                },
              }}
              exit={{
                opacity: 0,
                scale: 0.94,
                transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
              }}
              className={itemClassName}
            >
              {renderItem(item, i)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}

export default AnimatedList;
