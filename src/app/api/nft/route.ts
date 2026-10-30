import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mintNft, getAllNfts } from "@/lib/nft";
import { put } from "@vercel/blob";

// GET /api/nft — list all NFTs (admin)
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json({ success: false, message: "Admin only." }, { status: 403 });
    }
    const nfts = await getAllNfts();
    return NextResponse.json({ success: true, nfts });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST /api/nft — mint a new NFT (admin only, multipart/form-data)
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json({ success: false, message: "Admin only." }, { status: 403 });
    }

    const formData = await request.formData();
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim() || undefined;
    const editionNote = String(formData.get("edition_note") || "").trim() || undefined;
    const creatorRoyaltyBpsStr = formData.get("creator_royalty_bps");
    const creatorRoyaltyBps = creatorRoyaltyBpsStr ? parseInt(String(creatorRoyaltyBpsStr), 10) : undefined;
    const creatorNameOverride = String(formData.get("creator_name") || "").trim() || undefined;

    if (!title) return NextResponse.json({ success: false, message: "Title is required." }, { status: 400 });

    // Handle image upload to Vercel Blob
    const imageFile = formData.get("image") as File | null;
    let imageUrl = String(formData.get("image_url") || "").trim();

    if (imageFile && imageFile.size > 0) {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (!token) {
        return NextResponse.json({ success: false, message: "BLOB_READ_WRITE_TOKEN not configured." }, { status: 500 });
      }
      const ext = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeName = `nfts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const blob = await put(safeName, imageFile, { access: "public", token });
      imageUrl = blob.url;
    }

    if (!imageUrl) return NextResponse.json({ success: false, message: "Image is required." }, { status: 400 });

    const result = await mintNft({
      adminId: user.id,
      title,
      description,
      imageUrl,
      editionNote,
      creatorRoyaltyBps,
      creatorName: creatorNameOverride,
    });

    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (err: any) {
    console.error("POST /api/nft error:", err);
    return NextResponse.json({ success: false, message: err.message || "Server error" }, { status: 500 });
  }
}
