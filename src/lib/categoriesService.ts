import { connectDB } from "@/lib/db";
import { Category } from "@/models/Category";
import { Note } from "@/models/Note";
import { z } from "zod";

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(30),
});

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(30),
});

export async function fetchCategories(portal: string) {
  try {
    await connectDB();
    const categories = await Category.find({ portal }).sort({ createdAt: 1 });
    return {
      success: true as const,
      categories: categories.map((c) => ({
        id: c._id.toString(),
        name: c.name,
      })),
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to load categories",
      categories: [],
    };
  }
}

export async function createCategory(name: string, portal: string) {
  try {
    await connectDB();
    const validated = CreateCategorySchema.safeParse({ name });
    if (!validated.success) {
      return { success: false as const, error: "Invalid category name" };
    }

    const existing = await Category.findOne({ name: validated.data.name, portal });
    if (existing) {
      return { success: false as const, error: "Category already exists" };
    }

    const newCategory = await Category.create({ name: validated.data.name, portal });
    return {
      success: true as const,
      category: { id: newCategory._id.toString(), name: newCategory.name },
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to create category",
    };
  }
}

export async function updateCategory(id: string, name: string, portal: string) {
  try {
    await connectDB();
    const validated = UpdateCategorySchema.safeParse({ name });
    if (!validated.success) {
      return { success: false as const, error: "Invalid category name" };
    }

    const existing = await Category.findOne({ name: validated.data.name, portal, _id: { $ne: id } });
    if (existing) {
      return { success: false as const, error: "Category already exists" };
    }

    const updated = await Category.findOneAndUpdate(
      { _id: id, portal },
      { name: validated.data.name },
      { new: true }
    );
    if (!updated) {
      return { success: false as const, error: "Category not found" };
    }

    return {
      success: true as const,
      category: { id: updated._id.toString(), name: updated.name },
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to update category",
    };
  }
}

export async function deleteCategory(id: string, portal: string) {
  try {
    await connectDB();
    const category = await Category.findOne({ _id: id, portal });
    if (!category) {
      return { success: false as const, error: "Category not found" };
    }

    const deleteNotesResult = await Note.deleteMany({ categoryId: id, portal });
    await Category.deleteOne({ _id: id, portal });

    return {
      success: true as const,
      deletedNotesCount: deleteNotesResult.deletedCount ?? 0,
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Failed to delete category",
    };
  }
}
