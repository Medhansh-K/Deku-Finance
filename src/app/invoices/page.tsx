import { redirect } from "next/navigation";

// The real sales invoice editor and register live in the GST hub; this route used to show sample data.
export default function Page() {
  redirect("/gst");
}
