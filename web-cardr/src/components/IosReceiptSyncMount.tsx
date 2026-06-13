// Headless component that mounts `useIosReceiptSync` once at the app root.
//
// Mounting the hook here means the StoreKit transaction observer + the
// foreground re-validate listener are always live for the signed-in user
// — purchase, renewal, and restore screens get subscription-state updates
// pushed to them via the `subscription:refresh` window event without
// having to wire the hook up themselves.
import { useIosReceiptSync } from "@/hooks/useIosReceiptSync";

const IosReceiptSyncMount = () => {
  useIosReceiptSync();
  return null;
};

export default IosReceiptSyncMount;
