import { notFound } from "next/navigation";
import SettingsClient from "./SettingsClient";

export default function SettingsPage() {
  if (process.env.VERCEL === "1") {
    notFound();
  }
  return <SettingsClient />;
}
