# Phase 1 Performance Optimization Plan
## Task-by-Task Implementation Guide

---

## 🎯 **TASK OVERVIEW**

| Task | Priority | Estimated Time | Impact |
|------|----------|----------------|---------|
| **Task 1**: Store Selector Optimization | High | 2-3 hours | High |
| **Task 2**: Form Component Memoization | High | 3-4 hours | High |
| **Task 3**: Data Fetching Optimization | Medium | 2-3 hours | Medium |
| **Task 4**: Component Splitting | Medium | 4-5 hours | Medium |
| **Task 5**: FeatureSections Async Fix | High | 2-3 hours | High |

**Total Estimated Time: 13-18 hours**

---

## 📝 **TASK 1: Comprehensive Store Optimization**
**Priority: HIGH** | **Time: 4-5 hours** | **Impact: HIGH**

### **Problem**
Store subscriptions lack shallow comparison and optimal selectors.

### **Analysis Summary**
- **Form Types**: CharacterInput, SpellInput, ClassInput, RaceInput, EquipmentInput, FeatInput, BackgroundInput
- **Usage Pattern**: Each component creates 5-10 individual selectors: `store((state) => state.current?.property)`
- **Performance Impact**: No shallow comparison = every store change triggers all component re-renders
- **Type Safety Issue**: Character-specific properties (modifiers, expertise) don't exist on all form types

### **Step 1.1: Simple Store Optimization (The Real Fix)**

**The Core Issue**: Missing `shallow` comparison, not the number of hooks.

```typescript
// src/store/formStore.ts
import { shallow } from 'zustand/shallow'

// Keep existing useTypedFormStore
export const useTypedFormStore = <T extends FormDataType>() => {
  return useFormStore as unknown as UseFormStore<T>
}

// Simple helper for optimized selectors
export const useOptimizedSelector = <T extends FormDataType, R>(
  selector: (state: UseFormStore<T>) => R
) => {
  const store = useTypedFormStore<T>()
  return store(selector, shallow)
}

// Generic property selector with shallow comparison
export const useFormProperty = <T extends FormDataType, K extends keyof T>(
  key: K
) => {
  const store = useTypedFormStore<T>()
  return store((state) => state.current?.[key], shallow)
}

// Multiple properties selector
export const useFormProperties = <T extends FormDataType, K extends keyof T>(
  keys: K[]
) => {
  const store = useTypedFormStore<T>()
  return store((state) => {
    if (!state.current) return null
    return keys.reduce((acc, key) => {
      acc[key] = state.current![key]
      return acc
    }, {} as Pick<T, K>)
  }, shallow)
}

// That's it! Simple, consistent, type-safe approach for all form types.
```

### **Step 1.2: Simple Usage Examples**

#### **Character Components**
```typescript
// src/components/Form/Steps/Characters/Features/FeatureSections.tsx
import { useFormProperty, useFormProperties } from '@/store/formStore'

// Individual properties with shallow comparison
const modifiers = useFormProperty<CharacterInput>('modifiers')
const expertise = useFormProperty<CharacterInput>('expertise')
const proficiencies = useFormProperty<CharacterInput>('proficiencies')
const features = useFormProperty<CharacterInput>('features')

// Or multiple properties at once
const { modifiers, expertise, proficiencies } = useFormProperties<CharacterInput>(['modifiers', 'expertise', 'proficiencies'])
```

#### **Spell Components**
```typescript
// src/components/Form/Steps/Spells/Details.tsx
import { useFormProperty, useFormProperties } from '@/store/formStore'

// Individual properties with shallow comparison
const requirements = useFormProperty<SpellInput>('requirements')
const level = useFormProperty<SpellInput>('level')
const school = useFormProperty<SpellInput>('school')

// Or multiple properties at once
const { requirements, level, school } = useFormProperties<SpellInput>(['requirements', 'level', 'school'])
```

#### **Class Components**
```typescript
// src/components/Form/Steps/Classes/Details.tsx
import { useFormProperty } from '@/store/formStore'

const category = useFormProperty<ClassInput>('category')
const parentClass = useFormProperty<ClassInput>('parentClass')
const spellcasting = useFormProperty<ClassInput>('spellcasting')
```

#### **Race/Background/Equipment Components**
```typescript
// Race components
const features = useFormProperty<RaceInput>('features')
const ancestry = useFormProperty<RaceInput>('ancestry')

// Background components  
const features = useFormProperty<BackgroundInput>('features')
const proficiencies = useFormProperty<BackgroundInput>('proficiencies')

// Equipment components
const properties = useFormProperty<EquipmentInput>('properties')
const damage = useFormProperty<EquipmentInput>('damage')
```

#### **Any Component Pattern**
```typescript
// Before (causing re-renders)
const store = useTypedFormStore<T>()
const prop1 = store((state) => state.current?.prop1)  // ❌ No shallow comparison
const prop2 = store((state) => state.current?.prop2)  // ❌ No shallow comparison

// After (optimized with shallow comparison)
const prop1 = useFormProperty<T>('prop1')  // ✅ Shallow comparison
const prop2 = useFormProperty<T>('prop2')  // ✅ Shallow comparison

// Or batch multiple properties
const { prop1, prop2 } = useFormProperties<T>(['prop1', 'prop2'])  // ✅ Shallow comparison
```

### **Success Criteria**
- [ ] Reduced re-renders in form components
- [ ] Improved React DevTools Profiler metrics
- [ ] No functionality regressions

---

## 📝 **TASK 2: Form Component Memoization**
**Priority: HIGH** | **Time: 3-4 hours** | **Impact: HIGH**

### **Problem**
Form components re-render unnecessarily on every field change.

### **Files to Modify**
- `src/components/Form/Steps/Characters/Features/FeatureSections.tsx`
- `src/components/Form/Steps/Characters/Features/FeatureOptions.tsx`
- Other heavy form components

### **Implementation Steps**

#### **Step 2.1: Add React.memo to Heavy Components**
```typescript
// src/components/Form/Steps/Characters/Features/FeatureSections.tsx
import { memo, useMemo, useCallback } from 'react'

const FeatureSections = memo(function FeatureSections({ 
  group, 
  featureId, 
  classId, 
  raceId, 
  backgroundId, 
  equipmentId, 
  featId, 
  optionId 
}) {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison function
  return (
    prevProps.featureId === nextProps.featureId &&
    prevProps.classId === nextProps.classId &&
    prevProps.raceId === nextProps.raceId &&
    prevProps.backgroundId === nextProps.backgroundId &&
    prevProps.equipmentId === nextProps.equipmentId &&
    prevProps.featId === nextProps.featId &&
    prevProps.optionId === nextProps.optionId
  )
})
```

#### **Step 2.2: Optimize useMemo Dependencies**
```typescript
// Replace heavy dependency arrays with stable references
const dropdowns = useMemo(() => {
  // Implementation
}, [
  feature?.id, // Instead of entire feature object
  option?.id,  // Instead of entire option object
  // Use primitive values instead of objects
])
```

#### **Step 2.3: Add useCallback for Event Handlers**
```typescript
const handleFieldChange = useCallback(({ value, path }) => {
  if (value == null || typeof value === 'boolean') {
    return formStore.removeField({ path })
  }
  // Handle field update
}, []) // Stable dependencies only
```

### **Success Criteria**
- [ ] Form components only re-render when their specific data changes
- [ ] Reduced "Profiler" flame graph complexity
- [ ] Maintained form functionality

---

## 📝 **TASK 3: Data Fetching Optimization**
**Priority: MEDIUM** | **Time: 2-3 hours** | **Impact: MEDIUM**

### **Problem**
Multiple API calls for related data cause network waterfalls.

### **Files to Modify**
- `src/apis/*.ts` files
- Components with multiple `useGet*` hooks

### **Implementation Steps**

#### **Step 3.1: Create Batch Query Hooks**
```typescript
// src/hooks/useBatchFeatureData.ts
export const useBatchFeatureData = (featureId: string, optionId?: string) => {
  const featureQuery = useGetFeature(featureId)
  const optionQuery = useGetFeatureOption(optionId || '', {
    enabled: !!optionId
  })
  
  return {
    data: {
      feature: featureQuery.data,
      option: optionQuery.data,
    },
    isLoading: featureQuery.isLoading || (optionId ? optionQuery.isLoading : false),
    error: featureQuery.error || optionQuery.error,
  }
}
```

#### **Step 3.2: Add Query Prefetching**
```typescript
// Prefetch related data
const queryClient = useQueryClient()

useEffect(() => {
  if (featureId) {
    // Prefetch related feature options
    queryClient.prefetchQuery({
      queryKey: ['featureOptions', featureId],
      queryFn: () => getFeatureOptions(featureId)
    })
  }
}, [featureId, queryClient])
```

#### **Step 3.3: Optimize Query Keys**
```typescript
// Use consistent, hierarchical query keys
const queryKey = ['features', featureId, 'options', optionId].filter(Boolean)
```

### **Success Criteria**
- [ ] Reduced number of simultaneous API calls
- [ ] Improved loading states
- [ ] Better caching behavior

---

## 📝 **TASK 4: Component Splitting**
**Priority: MEDIUM** | **Time: 4-5 hours** | **Impact: MEDIUM**

### **Problem**
Large components handle too many responsibilities.

### **Files to Create/Modify**
- Split `FeatureSections.tsx` into smaller components
- Create focused sub-components

### **Implementation Steps**

#### **Step 4.1: Extract Section Renderer**
```typescript
// src/components/Form/Steps/Characters/Features/SectionRenderer.tsx
const SectionRenderer = memo(function SectionRenderer({
  section,
  sectionStep,
  sectionIndex,
  optionIndex,
  values,
  fieldListeners,
}) {
  // Handle individual section rendering
})
```

#### **Step 4.2: Extract Option Handler**
```typescript
// src/components/Form/Steps/Characters/Features/OptionHandler.tsx
const OptionHandler = memo(function OptionHandler({
  section,
  selectionCount,
  optionIndex,
  onFieldChange,
}) {
  // Handle option selection logic
})
```

#### **Step 4.3: Update Main Component**
```typescript
// Simplified main component that orchestrates sub-components
const FeatureSections = memo(function FeatureSections(props) {
  return (
    <Grid>
      {sections.map((section, index) => (
        <SectionRenderer
          key={`${section.id}-${index}`}
          section={section}
          index={index}
          {...otherProps}
        />
      ))}
    </Grid>
  )
})
```

### **Success Criteria**
- [ ] Smaller, focused components
- [ ] Better code organization
- [ ] Easier to debug and maintain

---

## 📝 **TASK 5: FeatureSections Async Fix**
**Priority: HIGH** | **Time: 2-3 hours** | **Impact: HIGH**

### **Problem**
Async operations in `useMemo` cause unpredictable behavior.

### **Files to Modify**
- `src/components/Form/Steps/Characters/Features/FeatureSections.tsx`

### **Implementation Steps**

#### **Step 5.1: Move Async to useEffect**
```typescript
const [sectionElements, setSectionElements] = useState<ReactNode[]>([])
const [isProcessing, setIsProcessing] = useState(false)

useEffect(() => {
  if (!feature) return
  
  const processFeatureSections = async () => {
    setIsProcessing(true)
    const elements: ReactNode[] = []
    
    for (const sectionStep of SECTION_STEPS) {
      if (!feature[sectionStep]?.length) continue
      
      for (const [sIndex, sectionId] of feature[sectionStep].entries()) {
        const section = sectionMap.schema.parse(sectionMap.get(sectionId))
        
        if (section?.attributes?.some(attr => attr === Attributes.PROVIDES_OPTIONS)) {
          const selectionCount = section?.selectionCount || 1
          
          for (let index = 0; index < selectionCount; index++) {
            const optionIndex = `${section?.__kind}-${featureIndex}-${sIndex}-${index}`
            
            const { options, label, path, exist } = await getSectionOptions({
              data: values,
              section,
              sectionStep,
              optionIndex,
            })
            
            elements.push(
              <SectionRenderer
                key={path + optionIndex}
                section={section}
                options={options}
                label={label}
                path={path}
                exist={exist}
                optionIndex={optionIndex}
                onFieldChange={handleFieldChange}
              />
            )
          }
        }
      }
    }
    
    setSectionElements(elements)
    setIsProcessing(false)
  }
  
  processFeatureSections()
}, [feature, values, featureIndex]) // Stable dependencies
```

#### **Step 5.2: Add Loading State**
```typescript
if (isProcessing) {
  return <Loading message="Processing feature sections..." />
}

return <>{sectionElements}</>
```

#### **Step 5.3: Add Error Boundary**
```typescript
// Wrap component in error boundary for async error handling
<ErrorBoundary fallback={<div>Error loading feature sections</div>}>
  <FeatureSections {...props} />
</ErrorBoundary>
```

### **Success Criteria**
- [ ] No more async operations in render
- [ ] Predictable component behavior
- [ ] Proper loading and error states
- [ ] FeatureSections component works correctly

---

## 🚀 **EXECUTION PLAN**

### **Week 1: High Priority Tasks**
- **Day 1-2**: Task 1 (Store Optimization) + Task 5 (Async Fix)
- **Day 3-4**: Task 2 (Component Memoization)
- **Day 5**: Testing and validation

### **Week 2: Medium Priority + Polish**
- **Day 1-2**: Task 3 (Data Fetching)
- **Day 3-4**: Task 4 (Component Splitting)
- **Day 5**: Performance testing and optimization

### **Success Metrics**
- [ ] React DevTools Profiler shows reduced re-renders
- [ ] Lighthouse Performance score improvement
- [ ] Form interactions feel snappier
- [ ] No functionality regressions
- [ ] FeatureSections component works correctly

---

## 🔧 **TESTING STRATEGY**

1. **Before/After Performance Metrics**
   - React DevTools Profiler recordings
   - Lighthouse scores
   - Bundle size analysis

2. **Functionality Testing**
   - All form interactions work
   - Data persistence works
   - No console errors

3. **User Experience Testing**
   - Form feels responsive
   - Loading states are appropriate
   - Error handling works

---

**Ready to start with Task 1 (Store Optimization) and Task 5 (Async Fix)?**
