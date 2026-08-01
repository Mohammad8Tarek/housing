import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import swaggerUi from "swagger-ui-express";
import { type Express } from "express";

export const registry = new OpenAPIRegistry();

// Basic setup - you can register Zod schemas and routes to this registry
// Example:
// registry.registerPath({
//   method: 'get',
//   path: '/api/healthz',
//   description: 'Health check endpoint',
//   responses: {
//     200: { description: 'OK' }
//   }
// });

export function setupSwagger(app: Express) {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  const openApiDocument = generator.generateDocument({
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "Sunrise Housing API",
      description: "API for Sunrise Housing Management System",
    },
    servers: [{ url: "/" }],
  });

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
}
