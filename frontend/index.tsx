import {
  initializeBlock,
  useLoadable,
  useRecordIds,
  useWatchable,
} from "@airtable/blocks/ui";
import React, { useEffect, useState } from "react";

import {
  Box,
  Text,
  FormField,
  Button,
  Input,
  Select,
  useBase,
  useCursor,
  useRecords,
} from "@airtable/blocks/ui";

import { useSession } from "@airtable/blocks/ui";

import {
  SelectOption,
  SelectOptionValue,
} from "@airtable/blocks/dist/types/src/ui/select_and_select_buttons_helpers";

function Container({ children }) {
  return (
    <Box
      position="absolute"
      top={0}
      bottom={0}
      left={0}
      right={0}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
    >
      {children}
    </Box>
  );
}

function isCourierTokenValid(token: string) {
  return typeof token === "string" && token.length === 36;
}

function Pigeonaire() {
  const session = useSession();

  const base = useBase();
  const cursor = useCursor();
  useLoadable(cursor);
  const selectedRecordIds = cursor.selectedRecordIds;
  useWatchable(cursor, ["selectedRecordIds", "selectedFieldIds"]);
  const [banner, setBanner] = useState("");
  const [courierAuthToken, setCourierAuthToken] = useState<string>("");
  const [courierEvent, setCourierEvent] = useState<SelectOptionValue>("");
  const [events, setEvents] = useState<SelectOption[]>();
  const [autoSync, setAutoSync] = useState<boolean>(false);

  const tableToUpdate = base.getTableByName(base.tables[0].name);

  const records = useRecords(tableToUpdate);
  const [existingRecords, setExistingRecords] = useState<string[]>(
    useRecordIds(tableToUpdate)
  );

  const fetchEvents = async (token: string) =>
    await fetch(`http://localhost:9050/events/${token}`).then((response) =>
      response.json()
    );

  const updateProfile = async (profileId: string) => {
    console.log("DELETED??", existingRecords.length, records.length);

    const record = records.find((record) => record?.id === profileId);
    if (record) {
      const profile = {
        id: record?.id,
        profile: tableToUpdate.fields
          .filter((field) => Boolean(record.getCellValue(field)))
          .reduce((acc, field) => {
            return {
              ...acc,
              [field.name]: record.getCellValue(field),
            };
          }, {}),
      };

      console.log("Newly added profile", profile);
      const options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${courierAuthToken}`,
        },
        body: JSON.stringify({
          users: [profile],
        }),
      };

      await fetch("http://localhost:9050/profiles", options).then((response) =>
        response.json()
      );
    }
  };

  const deleteProfile = async (profileId: string) => {
    const options = {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${courierAuthToken}`,
      },
    };

    await fetch(`http://localhost:9050/profiles/${profileId}`, options).then(
      (response) => response.json()
    );
    setBanner("Profile deleted");
  };

  const sendNotification = async () => {
    console.log("Sending notification to", selectedRecordIds.length);
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${courierAuthToken}`,
      },
      body: JSON.stringify({
        messages: selectedRecordIds.map((user_id) => ({
          to: { user_id },
          template: courierEvent,
        })),
      }),
    };

    fetch("http://localhost:9050/send", options)
      .then((response) => response.json())
      .then((response) => console.log(response))
      .catch((err) => console.error(err));
  };

  const updateCourierAuthToken = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCourierAuthToken(e.target.value);
  };

  useEffect(() => {
    setCourierAuthToken(
      localStorage.getItem("courierAuthToken") === null
        ? ""
        : localStorage.getItem("courierAuthToken")
    );

    console.log("records", tableToUpdate.fields[0], records[0]?.id);
  }, []);

  useEffect(() => {
    if (isCourierTokenValid(courierAuthToken)) {
      localStorage.setItem("courierAuthToken", courierAuthToken);
      fetchEvents(courierAuthToken).then((response: Array<string>) => {
        setEvents(
          response.map((event) => ({
            label: event,
            value: event,
            disabled: false,
          }))
        );
      });
    }
  }, [courierAuthToken]);

  useEffect(() => {
    if (existingRecords.length < records.length) {
      // new record added
      setExistingRecords([...existingRecords, records[records.length - 1].id]);
      updateProfile(records[records.length - 1].id);
    }
    if (existingRecords.length > records.length) {
      // record deleted
      const [deletedRecordId] = existingRecords.filter(
        (recordId) => !records.find((record) => record.id === recordId)
      );
      console.log("record deleted", deletedRecordId);
      setExistingRecords(
        existingRecords.filter((recordId) => recordId !== deletedRecordId)
      );
      deleteProfile(deletedRecordId);
    }

    if (existingRecords.length === records.length) {
      updateProfile(records[records.length - 1]?.id);
    }
  }, [records]);

  useEffect(() => {
    if (banner !== "") {
      setTimeout(() => {
        setBanner("");
      }, 10000);
    }
  }, [banner]);

  return (
    <Container>
      {banner !== "" && <Text textColor="red">{banner}</Text>}
      <Text>Welcome to Pigeonaire, {session.currentUser?.name}</Text>

      <Text textColor={"red"} marginBottom="2rem">
        {courierAuthToken.startsWith("pk") &&
          "You are using Courier Production Token"}
      </Text>
      <Box display="flex" flexDirection="column" width={"60%"}>
        <FormField label="Courier Token" width="70%" justifySelf="center">
          <Input
            type="password"
            value={courierAuthToken}
            onChange={updateCourierAuthToken}
          ></Input>
        </FormField>
      </Box>
      {selectedRecordIds.length >= 1 ? (
        <Box width="60%">
          <Text>
            {" "}
            {`Selected ${selectedRecordIds.length} records. Want to notify them all?`}
          </Text>
          <FormField label="Select Notification Event">
            <Select
              options={
                events?.length > 0
                  ? events
                  : [
                      {
                        value: "Loading...",
                        disabled: true,
                        label: "Loading...",
                      },
                    ]
              }
              value={courierEvent ?? events?.[0].value ?? "NO_EVENT"}
              onChange={(value) => setCourierEvent(value ?? "NO_EVENT")}
            ></Select>
          </FormField>
          <Button type="submit" onClick={() => sendNotification()}>
            Fly the 🕊
          </Button>
        </Box>
      ) : null}
    </Container>
  );
}

initializeBlock(() => <Pigeonaire />);
