import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([2019, 2020, 2021, 2022, 2023, 2024, 2025]);
}
