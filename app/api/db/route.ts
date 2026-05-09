import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

async function getNextSequenceValue(
  sequenceName: string,
  db: any
): Promise<number> {
  const sequenceDocument = await db
    .collection("counters")
    .findOneAndUpdate(
      { _id: sequenceName },
      { $inc: { sequence_value: 1 } },
      { returnDocument: "after", upsert: true }
    );
  return (
    sequenceDocument.sequence_value ||
    sequenceDocument.value?.sequence_value ||
    1
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");
    if (!table)
      return NextResponse.json({ error: "Missing table" }, { status: 400 });

    const client = await clientPromise;
    const db = client.db("konfeksi");

    // Sort logic
    const sortParams: any = {};
    const sortBy = searchParams.get("sortBy");
    const reverse = searchParams.get("reverse");
    if (sortBy) {
      sortParams[sortBy] = reverse === "true" ? -1 : 1;
    }

    const data = await db.collection(table).find({}).sort(sortParams).toArray();
    // In our case _id is just an ObjectId, but we store `id` as the auto-incremented integer!
    // Returning `id` as number, omitting `_id`
    const cleaned = data.map((d) => {
      const { _id, ...rest } = d;
      return rest;
    });

    return NextResponse.json(cleaned);
  } catch (error: any) {
    let errorMessage = error instanceof Error ? error.message : "Failed";
    if (
      errorMessage.includes("SSL alert number 80") ||
      errorMessage.includes("ssl3_read_bytes")
    ) {
      errorMessage =
        "Connection refused by MongoDB Atlas. Please ensure you have whitelisted all IPs (0.0.0.0/0) in your MongoDB Atlas Network Access settings.";
    } else if (
      errorMessage.toLowerCase().includes("bad auth") ||
      errorMessage.toLowerCase().includes("authentication failed")
    ) {
      errorMessage =
        "Failed to authenticate with MongoDB. Please check your database credentials in the connection string.";
    }
    console.warn(errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");
    const action = searchParams.get("action");

    const client = await clientPromise;
    const db = client.db("konfeksi");

    if (action === "bulkAdd") {
      const items = await request.json();
      for (const item of items) {
        if (!item.id) item.id = await getNextSequenceValue(table!, db);
      }
      const result = await db.collection(table!).insertMany(items);
      return NextResponse.json(result);
    } else if (action === "bulkDelete") {
      const ids = await request.json(); // array of numbers
      const result = await db
        .collection(table!)
        .deleteMany({ id: { $in: ids.map(Number) } });
      return NextResponse.json(result);
    } else if (action === "bulkUpdate") {
      const updates = await request.json(); // [{key: id, changes: {}}]
      const bulkOps = updates.map((u: any) => ({
        updateOne: {
          filter: { id: Number(u.key) },
          update: { $set: u.changes },
        },
      }));
      const result = await db.collection(table!).bulkWrite(bulkOps);
      return NextResponse.json(result);
    } else {
      // Normal add
      const data = await request.json();

      // Task C: Enrich with tailorName if tailorId is present
      if (data.tailorId && !data.tailorName) {
        const tailor = await db
          .collection("tailors")
          .findOne({ id: Number(data.tailorId) });
        if (tailor) {
          data.tailorName = tailor.partnerName
            ? `${tailor.name} & ${tailor.partnerName}`
            : tailor.name;
        }
      }

      if (!data.id) {
        data.id = await getNextSequenceValue(table!, db);
      }
      await db.collection(table!).insertOne(data);

      // Task B: Log the action
      if (table !== "appLogs") {
        await db.collection("appLogs").insertOne({
          id: await getNextSequenceValue("appLogs", db),
          date: new Date().toISOString(),
          user: data.createdBy || "System",
          action: "TAMBAH",
          details: `Menambah data ke ${table}`,
          table: table,
        });
      }

      const { _id, ...rest } = data;
      return NextResponse.json(rest);
    }
  } catch (error: any) {
    let errorMessage = error instanceof Error ? error.message : "Failed";
    if (
      errorMessage.includes("SSL alert number 80") ||
      errorMessage.includes("ssl3_read_bytes")
    ) {
      errorMessage =
        "Connection refused by MongoDB Atlas. Please ensure you have whitelisted all IPs (0.0.0.0/0) in your MongoDB Atlas Network Access settings.";
    } else if (
      errorMessage.toLowerCase().includes("bad auth") ||
      errorMessage.toLowerCase().includes("authentication failed")
    ) {
      errorMessage =
        "Failed to authenticate with MongoDB. Please check your database credentials in the connection string.";
    }
    console.warn(errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");
    const id = Number(searchParams.get("id"));
    const data = await request.json();

    // Ensure we don't modify the `id` itself
    delete data.id;
    delete data._id;

    const client = await clientPromise;
    const db = client.db("konfeksi");

    // Task C: Enrich with tailorName if tailorId is present and changed or name is missing
    if (data.tailorId && !data.tailorName) {
      const tailor = await db
        .collection("tailors")
        .findOne({ id: Number(data.tailorId) });
      if (tailor) {
        data.tailorName = tailor.partnerName
          ? `${tailor.name} & ${tailor.partnerName}`
          : tailor.name;
      }
    }

    const existing = await db.collection(table!).findOne({ id });
    await db.collection(table!).updateOne({ id }, { $set: data });

    // Task B: Log the action
    if (table !== "appLogs") {
      await db.collection("appLogs").insertOne({
        id: await getNextSequenceValue("appLogs", db),
        date: new Date().toISOString(),
        user: data.updatedBy || "System",
        action: "EDIT",
        details: `Mengedit data di ${table} (ID: ${id})`,
        table: table,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    let errorMessage = error instanceof Error ? error.message : "Failed";
    if (
      errorMessage.includes("SSL alert number 80") ||
      errorMessage.includes("ssl3_read_bytes")
    ) {
      errorMessage =
        "Connection refused by MongoDB Atlas. Please ensure you have whitelisted all IPs (0.0.0.0/0) in your MongoDB Atlas Network Access settings.";
    } else if (
      errorMessage.toLowerCase().includes("bad auth") ||
      errorMessage.toLowerCase().includes("authentication failed")
    ) {
      errorMessage =
        "Failed to authenticate with MongoDB. Please check your database credentials in the connection string.";
    }
    console.warn(errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");
    const id = Number(searchParams.get("id"));

    const client = await clientPromise;
    const db = client.db("konfeksi");

    await db.collection(table!).deleteOne({ id });

    // Task B: Log the action
    if (table !== "appLogs") {
      await db.collection("appLogs").insertOne({
        id: await getNextSequenceValue("appLogs", db),
        date: new Date().toISOString(),
        user: "Admin", // Generally admin for delete
        action: "HAPUS",
        details: `Menghapus data dari ${table} (ID: ${id})`,
        table: table,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    let errorMessage = error instanceof Error ? error.message : "Failed";
    if (
      errorMessage.includes("SSL alert number 80") ||
      errorMessage.includes("ssl3_read_bytes")
    ) {
      errorMessage =
        "Connection refused by MongoDB Atlas. Please ensure you have whitelisted all IPs (0.0.0.0/0) in your MongoDB Atlas Network Access settings.";
    } else if (
      errorMessage.toLowerCase().includes("bad auth") ||
      errorMessage.toLowerCase().includes("authentication failed")
    ) {
      errorMessage =
        "Failed to authenticate with MongoDB. Please check your database credentials in the connection string.";
    }
    console.warn(errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
