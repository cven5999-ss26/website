# header ------------------------------------------------------------------

# This script accesses the tables stored as Google Sheets which contain
# the course data. Each table is read and stored locally as a CSV.

# library -------------------------------------------------------------------

library(googlesheets4)
library(readr)
library(dplyr)

stopifnot(nzchar(Sys.getenv("GOOGLE_EMAIL")))

# authentication -----------------------------------------------------------

gs4_auth(cache = here::here(".secrets"), email = Sys.getenv("GOOGLE_EMAIL"))

# script ------------------------------------------------------------------

## course schedule

link_course_schedule <- "https://docs.google.com/spreadsheets/d/1yTbTPM2nZ46oPA7FjwMpoNnfcDfes2blKd0vyV7gnLY/edit?gid=0#gid=0"

googlesheets4::read_sheet(link_course_schedule) |> 
  mutate(title = case_when(
    !is.na(page_link) ~  paste0("[", title, "](", page_link, ")"),
    TRUE ~ title
  )) |> 
  write_csv(here::here("data/tbl-01-course-schedule.csv"))

# learning objectives ------------------------------------------------------

link_learning_objectives <- "https://docs.google.com/spreadsheets/d/1zZyEbJQH_qHrbl1oulViE0SsxnANbTmnsSZEGBmMcdo/edit?gid=0#gid=0"

googlesheets4::read_sheet(link_learning_objectives) |> 
  write_csv(here::here("data/tbl-02-learning-objectives.csv"))

# grading scheme ----------------------------------------------------------

link_grading_scheme <- "https://docs.google.com/spreadsheets/d/1VrOG9b_s7V3h7O7wzrtir43Uzj5XYt-nk6JDGIShiDI/edit?gid=0#gid=0"

googlesheets4::read_sheet(link_grading_scheme) |> 
  write_csv(here::here("data/tbl-03-grading-scheme.csv"))

# capstone project grading ---------------------------------------------

link_capstone_project_grading <- "https://docs.google.com/spreadsheets/d/1hNqmg4bOZmJB-2n0Nm6ATeOLs5VfRQDOU6gD362x74E/edit?gid=0#gid=0"

googlesheets4::read_sheet(link_capstone_project_grading) |> 
  write_csv(here::here("data/tbl-04-capstone-project-grading.csv"))


