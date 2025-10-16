"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Rocket } from "lucide-react"

export function NewsletterSignup() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Mock submission
    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setEmail("")
    }, 3000)
  }

  return (
    <div className="text-center">
      <div className="mb-6 inline-flex items-center justify-center rounded-full bg-accent/10 p-4">
        <Rocket className="h-8 w-8 text-accent" />
      </div>
      <h2 className="mb-4 text-3xl font-bold text-foreground">Objavuj s nami</h2>
      <p className="mb-8 text-pretty text-lg text-muted-foreground">
        Chceš viac objavov ako tento? Prihlás sa na odber Objavu dňa a dostávaj najzaujímavejšie snímky a články priamo
        do svojej schránky.
      </p>

      {submitted ? (
        <div className="rounded-lg bg-accent/10 p-4 text-accent">
          Ďakujeme za prihlásenie! Skontroluj svoju schránku.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-md gap-2">
          <Input
            type="email"
            id="newsletter-email"
            name="email"
            placeholder="tvoj@email.sk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1"
          />
          <Button type="submit" size="lg">
            Odoberať
          </Button>
        </form>
      )}
    </div>
  )
}
