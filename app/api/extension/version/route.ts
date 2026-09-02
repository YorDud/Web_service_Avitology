import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    version: "1.0.3",
    updateUrl:
      "https://chromewebstore.google.com/detail/helpsell/oigdilhkhidoinkpkfchkdpbkaobfhng",
  });
}