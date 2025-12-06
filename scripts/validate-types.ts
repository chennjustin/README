/**
 * Validate TypeScript types against Swagger schema
 * 
 * This script compares the Swagger schema definitions with the existing
 * TypeScript types in the frontend to ensure they are in sync.
 * 
 * Usage:
 *   npm run validate:types
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use createRequire to load CommonJS modules in ES module context
const require = createRequire(import.meta.url);

// Load swagger spec
const swaggerModule = require('../backend/src/config/swagger');
const swaggerSpec = swaggerModule.swaggerSpec;

// Configuration
const __filename_validate = fileURLToPath(import.meta.url);
const __dirname_validate = path.dirname(__filename_validate);
const FRONTEND_TYPES_FILE = path.join(__dirname_validate, '../frontend/src/types/index.ts');

interface TypeField {
  name: string;
  type: string;
  required: boolean;
  nullable?: boolean;
}

interface TypeDefinition {
  name: string;
  fields: TypeField[];
}

/**
 * Extract type definitions from TypeScript file
 */
function extractTypeDefinitions(filePath: string): TypeDefinition[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: Frontend types file not found: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const types: TypeDefinition[] = [];

  // Simple regex-based extraction (for basic interface definitions)
  const interfaceRegex = /export\s+interface\s+(\w+)\s*\{([^}]+)\}/g;
  let match;

  while ((match = interfaceRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2];
    const fields: TypeField[] = [];

    // Extract fields
    const fieldRegex = /(\w+)(\?)?\s*:\s*([^;]+);/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
      fields.push({
        name: fieldMatch[1],
        type: fieldMatch[3].trim(),
        required: !fieldMatch[2], // If ? exists, it's optional
      });
    }

    types.push({ name, fields });
  }

  return types;
}

/**
 * Extract schema from Swagger spec
 */
function extractSwaggerSchemas(): Map<string, TypeDefinition> {
  const spec = swaggerSpec as any;
  const schemas = spec.components?.schemas || {};
  const schemaMap = new Map<string, TypeDefinition>();

  for (const [schemaName, schema] of Object.entries(schemas)) {
    const schemaObj = schema as any;
    const fields: TypeField[] = [];

    if (schemaObj.properties) {
      const required = schemaObj.required || [];

      for (const [key, value] of Object.entries(schemaObj.properties)) {
        const prop = value as any;
        fields.push({
          name: key,
          type: getTypeName(prop),
          required: required.includes(key),
          nullable: prop.nullable || false,
        });
      }
    }

    schemaMap.set(schemaName, { name: schemaName, fields });
  }

  return schemaMap;
}

/**
 * Get type name from Swagger property
 */
function getTypeName(prop: any): string {
  if (prop.$ref) {
    return prop.$ref.split('/').pop() || 'any';
  }
  if (prop.type === 'array') {
    const itemType = prop.items ? getTypeName(prop.items) : 'any';
    return `${itemType}[]`;
  }
  return prop.type || 'any';
}

/**
 * Compare two type definitions
 */
function compareTypes(
  swaggerType: TypeDefinition,
  tsType: TypeDefinition
): { match: boolean; differences: string[] } {
  const differences: string[] = [];
  const swaggerFields = new Map(swaggerType.fields.map((f) => [f.name, f]));
  const tsFields = new Map(tsType.fields.map((f) => [f.name, f]));

  // Check for missing fields in TS type
  for (const [name, swaggerField] of swaggerFields) {
    const tsField = tsFields.get(name);
    if (!tsField) {
      if (swaggerField.required) {
        differences.push(`Missing required field: ${name}`);
      } else {
        differences.push(`Missing optional field: ${name}`);
      }
    } else {
      // Check type compatibility (simplified)
      if (!areTypesCompatible(swaggerField.type, tsField.type)) {
        differences.push(
          `Type mismatch for ${name}: Swagger has "${swaggerField.type}", TS has "${tsField.type}"`
        );
      }
      // Check required/optional mismatch
      if (swaggerField.required && !tsField.required) {
        differences.push(`Field ${name} is required in Swagger but optional in TS`);
      }
    }
  }

  // Check for extra fields in TS type (not in Swagger)
  for (const [name] of tsFields) {
    if (!swaggerFields.has(name)) {
      differences.push(`Extra field in TS type (not in Swagger): ${name}`);
    }
  }

  return {
    match: differences.length === 0,
    differences,
  };
}

/**
 * Check if two types are compatible (simplified check)
 */
function areTypesCompatible(swaggerType: string, tsType: string): boolean {
  // Normalize types for comparison
  const normalize = (t: string) => t.toLowerCase().replace(/\s+/g, '');

  const swaggerNorm = normalize(swaggerType);
  const tsNorm = normalize(tsType);

  // Direct match
  if (swaggerNorm === tsNorm) return true;

  // Handle array types
  if (swaggerNorm.endsWith('[]') && tsNorm.endsWith('[]')) {
    return areTypesCompatible(
      swaggerType.slice(0, -2),
      tsType.slice(0, -2)
    );
  }

  // Handle nullable types
  if (swaggerNorm.includes('null') || tsNorm.includes('null')) {
    const swaggerBase = swaggerNorm.replace('|null', '').replace('null|', '');
    const tsBase = tsNorm.replace('|null', '').replace('null|', '');
    if (swaggerBase === tsBase) return true;
  }

  // Type mappings
  const typeMap: Record<string, string[]> = {
    number: ['number', 'integer'],
    string: ['string'],
    boolean: ['boolean'],
  };

  for (const [key, values] of Object.entries(typeMap)) {
    if (values.includes(swaggerNorm) && values.includes(tsNorm)) {
      return true;
    }
  }

  return false;
}

/**
 * Main validation function
 */
function validateTypes(): void {
  console.log('Validating TypeScript types against Swagger schema...\n');

  const swaggerSchemas = extractSwaggerSchemas();
  const tsTypes = extractTypeDefinitions(FRONTEND_TYPES_FILE);

  // Create a map for easier lookup
  const tsTypeMap = new Map(tsTypes.map((t) => [t.name, t]));

  let totalIssues = 0;
  const issues: Array<{ type: string; problems: string[] }> = [];

  // Compare each Swagger schema with corresponding TS type
  for (const [schemaName, swaggerType] of swaggerSchemas) {
    const tsType = tsTypeMap.get(schemaName);

    if (!tsType) {
      console.log(`⚠  Type "${schemaName}" exists in Swagger but not in frontend types`);
      issues.push({
        type: schemaName,
        problems: ['Type not found in frontend types'],
      });
      totalIssues++;
      continue;
    }

    const comparison = compareTypes(swaggerType, tsType);
    if (!comparison.match) {
      console.log(`❌ Type "${schemaName}" has differences:`);
      comparison.differences.forEach((diff) => {
        console.log(`   - ${diff}`);
      });
      issues.push({
        type: schemaName,
        problems: comparison.differences,
      });
      totalIssues += comparison.differences.length;
    } else {
      console.log(`✓  Type "${schemaName}" matches`);
    }
  }

  // Check for TS types not in Swagger
  for (const tsType of tsTypes) {
    if (!swaggerSchemas.has(tsType.name)) {
      console.log(`ℹ  Type "${tsType.name}" exists in frontend but not in Swagger (may be intentional)`);
    }
  }

  console.log('\n' + '='.repeat(50));
  if (totalIssues === 0) {
    console.log('✓ All types are in sync!');
    process.exit(0);
  } else {
    console.log(`❌ Found ${totalIssues} issue(s) across ${issues.length} type(s)`);
    console.log('\nRecommendation: Run "npm run generate:types" to regenerate types from Swagger');
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('validate-types.ts')) {
  try {
    validateTypes();
  } catch (error) {
    console.error('Error validating types:', error);
    process.exit(1);
  }
}

export { validateTypes };

