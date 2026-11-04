import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getUserVaultNfts,
  listNftForSale,
  cancelNftListing,
  buyNftListing,
  makePrivateOffer,
  cancelPrivateOffer,
  acceptPrivateOffer,
  rejectPrivateOffer,
  getActiveListings,
} from "@/lib/nft";

// GET /api/nft/trade — Get user's vault + offers, or public active P2P listings
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    if (mode === "listings") {
      const listings = await getActiveListings();
      return NextResponse.json({ success: true, listings });
    }

    // Default: Return current user's vault & direct offers
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const data = await getUserVaultNfts(user.id);
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    console.error("GET /api/nft/trade error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST /api/nft/trade — P2P marketplace actions
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized. Please log in." }, { status: 401 });
    }
    if (user.isManager) {
      return NextResponse.json({ success: false, message: "Manager accounts cannot perform NFT trades." }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "list": {
        const { nftId, price } = body;
        if (!nftId || !price) {
          return NextResponse.json({ success: false, message: "nftId and price are required." }, { status: 400 });
        }
        const res = await listNftForSale(user.id, String(nftId), Number(price));
        return NextResponse.json(res, { status: res.success ? 200 : 400 });
      }

      case "cancel_listing": {
        const { listingId } = body;
        if (!listingId) {
          return NextResponse.json({ success: false, message: "listingId is required." }, { status: 400 });
        }
        const res = await cancelNftListing(user.id, String(listingId));
        return NextResponse.json(res, { status: res.success ? 200 : 400 });
      }

      case "buy_listing": {
        const { listingId } = body;
        if (!listingId) {
          return NextResponse.json({ success: false, message: "listingId is required." }, { status: 400 });
        }
        const res = await buyNftListing(user.id, String(listingId));
        return NextResponse.json(res, { status: res.success ? 200 : 400 });
      }

      case "make_offer": {
        const { nftId, amount } = body;
        if (!nftId || !amount) {
          return NextResponse.json({ success: false, message: "nftId and offer amount are required." }, { status: 400 });
        }
        const res = await makePrivateOffer(user.id, String(nftId), Number(amount));
        return NextResponse.json(res, { status: res.success ? 200 : 400 });
      }

      case "cancel_offer": {
        const { offerId } = body;
        if (!offerId) {
          return NextResponse.json({ success: false, message: "offerId is required." }, { status: 400 });
        }
        const res = await cancelPrivateOffer(user.id, String(offerId));
        return NextResponse.json(res, { status: res.success ? 200 : 400 });
      }

      case "accept_offer": {
        const { offerId } = body;
        if (!offerId) {
          return NextResponse.json({ success: false, message: "offerId is required." }, { status: 400 });
        }
        const res = await acceptPrivateOffer(user.id, String(offerId));
        return NextResponse.json(res, { status: res.success ? 200 : 400 });
      }

      case "reject_offer": {
        const { offerId } = body;
        if (!offerId) {
          return NextResponse.json({ success: false, message: "offerId is required." }, { status: 400 });
        }
        const res = await rejectPrivateOffer(user.id, String(offerId));
        return NextResponse.json(res, { status: res.success ? 200 : 400 });
      }

      default:
        return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
    }
  } catch (err: any) {
    console.error("POST /api/nft/trade error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
