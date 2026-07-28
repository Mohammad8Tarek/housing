import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  date,
  time,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const portalFoodMenuTable = pgTable("portal_food_menu", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  price: text("price").default("0"),
  mealType: text("meal_type").notNull().default("daily"), // daily | weekly | special
  category: text("category").notNull().default("main"), // main | side | drink | dessert
  date: date("date"),
  available: boolean("available").notNull().default(true),
  imageUrl: text("image_url"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const portalMealOrdersTable = pgTable("portal_meal_orders", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  menuItemId: integer("menu_item_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  orderDate: date("order_date").notNull(),
  status: text("status").notNull().default("confirmed"), // confirmed | prepared | served | cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const portalTransportSchedulesTable = pgTable(
  "portal_transport_schedules",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull(),
    route: text("route").notNull(),
    routeAr: text("route_ar"),
    location: text("location"),
    locationAr: text("location_ar"),
    departure: text("departure").notNull(),
    arrival: text("arrival"),
    days: text("days").notNull().default("daily"), // daily | weekdays | weekends | custom
    customDays: text("custom_days"), // comma-separated: mon,tue,wed,...
    capacity: integer("capacity").notNull().default(20),
    notes: text("notes"),
    notesAr: text("notes_ar"),
    active: boolean("active").notNull().default(true),
    createdBy: integer("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const portalTransportBookingsTable = pgTable(
  "portal_transport_bookings",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull(),
    employeeId: integer("employee_id").notNull(),
    scheduleId: integer("schedule_id").notNull(),
    bookingDate: date("booking_date").notNull(),
    status: text("status").notNull().default("confirmed"), // confirmed | boarded | cancelled
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const insertFoodMenuSchema = createInsertSchema(
  portalFoodMenuTable,
).omit({ id: true, createdAt: true });
export const insertMealOrderSchema = createInsertSchema(portalMealOrdersTable)
  .omit({ id: true, createdAt: true })
  .extend({
    menuItemId: z.number(),
    quantity: z.number().min(1).default(1),
    orderDate: z.string(),
  });
export const insertTransportScheduleSchema = createInsertSchema(
  portalTransportSchedulesTable,
).omit({ id: true, createdAt: true });
export const insertTransportBookingSchema = createInsertSchema(
  portalTransportBookingsTable,
).omit({ id: true, createdAt: true });

export type InsertFoodMenu = z.infer<typeof insertFoodMenuSchema>;
export type FoodMenuItem = typeof portalFoodMenuTable.$inferSelect;
export type MealOrder = typeof portalMealOrdersTable.$inferSelect;
export type TransportSchedule =
  typeof portalTransportSchedulesTable.$inferSelect;
export type TransportBooking = typeof portalTransportBookingsTable.$inferSelect;
