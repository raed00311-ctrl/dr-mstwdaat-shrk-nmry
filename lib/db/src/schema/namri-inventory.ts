import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const appUserRoleEnum = pgEnum("app_user_role", [
  "admin",
  "warehouse_manager",
  "viewer",
]);
export type AppUserRole = (typeof appUserRoleEnum.enumValues)[number];

export const movementTypeEnum = pgEnum("inventory_movement_type", [
  "in",
  "out",
  "adjustment",
]);

export const movementApprovalStatusEnum = pgEnum(
  "inventory_movement_approval_status",
  ["pending", "approved", "rejected"],
);

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "completed",
]);

export const warehousesTable = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  location: text("location"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const itemsTable = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  minStock: numeric("min_stock", { precision: 14, scale: 3, mode: "number" })
    .notNull()
    .default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const inventoryBalancesTable = pgTable(
  "inventory_balances",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id")
      .notNull()
      .references(() => itemsTable.id),
    warehouseId: integer("warehouse_id")
      .notNull()
      .references(() => warehousesTable.id),
    quantity: numeric("quantity", { precision: 14, scale: 3, mode: "number" })
      .notNull()
      .default(0),
    averageUnitCost: numeric("average_unit_cost", {
      precision: 14,
      scale: 4,
      mode: "number",
    })
      .notNull()
      .default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("inventory_balances_item_warehouse_unique").on(
      table.itemId,
      table.warehouseId,
    ),
    index("inventory_balances_warehouse_idx").on(table.warehouseId),
  ],
);

export const projectsTable = pgTable("construction_projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location"),
  status: projectStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const appUsersTable = pgTable("app_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  role: appUserRoleEnum("role").notNull().default("viewer"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export type AppUser = typeof appUsersTable.$inferSelect;

export const inventoryMovementsTable = pgTable(
  "inventory_movements",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id")
      .notNull()
      .references(() => itemsTable.id),
    warehouseId: integer("warehouse_id")
      .notNull()
      .references(() => warehousesTable.id),
    type: movementTypeEnum("type").notNull(),
    approvalStatus: movementApprovalStatusEnum("approval_status")
      .notNull()
      .default("approved"),
    quantity: numeric("quantity", { precision: 14, scale: 3, mode: "number" })
      .notNull(),
    unitCost: numeric("unit_cost", { precision: 14, scale: 4, mode: "number" })
      .notNull()
      .default(0),
    totalValue: numeric("total_value", { precision: 16, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    supplier: text("supplier"),
    invoiceNumber: text("invoice_number"),
    projectId: integer("project_id").references(() => projectsTable.id, {
      onDelete: "set null",
    }),
    recipient: text("recipient"),
    notes: text("notes"),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    actorId: text("actor_id")
      .notNull()
      .references(() => appUsersTable.id),
    approvedBy: text("approved_by").references(() => appUsersTable.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvalNotes: text("approval_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("inventory_movements_occurred_on_idx").on(table.occurredOn),
    index("inventory_movements_item_idx").on(table.itemId),
    index("inventory_movements_warehouse_idx").on(table.warehouseId),
    index("inventory_movements_project_idx").on(table.projectId),
  ],
);
