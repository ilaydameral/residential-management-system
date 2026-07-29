import { useEffect, useState, type FormEvent } from 'react'

type Property = {
  id: number
  name: string
  propertyType: string
  addressLine: string
  city: string
  district: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

type PropertyForm = {
  name: string
  propertyType: string
  addressLine: string
  city: string
  district: string
  description: string
}

const initialForm: PropertyForm = {
  name: '',
  propertyType: '',
  addressLine: '',
  city: '',
  district: '',
  description: '',
}

function App() {
  const [properties, setProperties] = useState<Property[]>([])
  const [form, setForm] = useState<PropertyForm>(initialForm)

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch(
          'http://localhost:5006/api/properties',
        )

        if (!response.ok) {
          throw new Error('Properties could not be loaded.')
        }

        const data: Property[] = await response.json()
        setProperties(data)
      } catch {
        setErrorMessage('The property list could not be loaded.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProperties()
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const response = await fetch(
        'http://localhost:5006/api/properties',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(form),
        },
      )

      if (!response.ok) {
        throw new Error('Property could not be created.')
      }

      const createdProperty: Property = await response.json()

      setProperties((currentProperties) => [
        ...currentProperties,
        createdProperty,
      ])

      setForm(initialForm)
    } catch {
      setErrorMessage('The property could not be created.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main>
      <h1>Residential Management System</h1>
      <p>Phase 1 full-stack prototype</p>

      <section>
        <h2>Add Property</h2>

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name">Property name</label>
            <input
              id="name"
              value={form.name}
              onChange={(event) =>
                setForm({
                  ...form,
                  name: event.target.value,
                })
              }
              required
            />
          </div>

          <div>
            <label htmlFor="propertyType">Property type</label>
            <input
              id="propertyType"
              value={form.propertyType}
              onChange={(event) =>
                setForm({
                  ...form,
                  propertyType: event.target.value,
                })
              }
              required
            />
          </div>

          <div>
            <label htmlFor="addressLine">Address</label>
            <input
              id="addressLine"
              value={form.addressLine}
              onChange={(event) =>
                setForm({
                  ...form,
                  addressLine: event.target.value,
                })
              }
              required
            />
          </div>

          <div>
            <label htmlFor="city">City</label>
            <input
              id="city"
              value={form.city}
              onChange={(event) =>
                setForm({
                  ...form,
                  city: event.target.value,
                })
              }
              required
            />
          </div>

          <div>
            <label htmlFor="district">District</label>
            <input
              id="district"
              value={form.district}
              onChange={(event) =>
                setForm({
                  ...form,
                  district: event.target.value,
                })
              }
              required
            />
          </div>

          <div>
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={form.description}
              onChange={(event) =>
                setForm({
                  ...form,
                  description: event.target.value,
                })
              }
            />
          </div>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Add property'}
          </button>
        </form>
      </section>

      <section>
        <h2>Properties</h2>

        {isLoading && <p>Loading...</p>}

        {errorMessage && <p>{errorMessage}</p>}

        {!isLoading &&
          !errorMessage &&
          properties.length === 0 && (
            <p>No properties found.</p>
          )}

        <ul>
          {properties.map((property) => (
            <li key={property.id}>
              <h3>{property.name}</h3>

              <p>
                {property.propertyType} — {property.city}/
                {property.district}
              </p>

              <p>{property.addressLine}</p>

              {property.description && (
                <p>{property.description}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App