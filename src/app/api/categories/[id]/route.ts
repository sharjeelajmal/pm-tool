import { updateCategory, deleteCategory } from "@/lib/categoriesService";
import { jsonResponse } from "@/lib/apiHeaders";
import { getAuthPayload } from "@/lib/authUtil";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const auth = await getAuthPayload();
    const portal = auth.portal;
    const body = await request.json();

    if (!body || !body.name) {
      return jsonResponse({ success: false, error: "Category name is required" }, 400);
    }

    const result = await updateCategory(id, body.name, portal);
    return jsonResponse(result, result.success ? 200 : 400);
  } catch (error) {
    return jsonResponse({ success: false, error: "Failed to update category" }, 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const auth = await getAuthPayload();
    const portal = auth.portal;

    const result = await deleteCategory(id, portal);
    return jsonResponse(result, result.success ? 200 : 400);
  } catch (error) {
    return jsonResponse({ success: false, error: "Failed to delete category" }, 500);
  }
}
