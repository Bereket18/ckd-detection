# Files with TypeScript compilation errors - need manual fixing

## src/services/api.ts
**Issue**: Template literal backticks corrupted during automated fixes
**Symptoms**: 
- Parse errors on lines 163, 234, 306
- \Expected semicolon\ TypeScript errors
- Build fails with 84+ errors

**Fix needed**:
1. Regenerate from design.md specification, OR
2. Manually fix template literals: Ensure all template strings use backticks correctly
3. Fix parameter property modifiers in APIError and NetworkError classes
4. Update type-only imports: \import type { ... }\

## src/services/error-handler.ts  
**Issue**: Type import and strict mode issues
**Fix needed**:
1. Change to type-only imports
2. Add non-null assertions where needed

## Test files
**Issue**: TypeScript 6.0 strict mode compliance
**Status**: Partially fixed, may need additional non-null assertions

## How to fix
See \.kiro/specs/ckd-frontend/design.md\ for complete specifications.

Regenerate api.ts following the API Client Service section in design.md.
